package server

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/mukopikmin/sadoku/src/server/cli"
	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	httpadapter "github.com/mukopikmin/sadoku/src/server/http"
	"github.com/mukopikmin/sadoku/src/server/session"
	"github.com/mukopikmin/sadoku/src/server/storage"
)

func Run(ctx context.Context, args []string, out io.Writer) error {
	return cli.Execute(ctx, args, out, func(ctx context.Context, options cli.StartOptions) error { return Start(ctx, options, out) })
}
func Start(ctx context.Context, options cli.StartOptions, out io.Writer) error {
	_, source, _ := session.Source(options.Source)
	settings, _, err := config.Read()
	if err != nil {
		return err
	}
	if options.MaxDepth != nil {
		settings.MaxDepth = *options.MaxDepth
	}
	if options.MaxFiles != nil {
		settings.MaxFiles = *options.MaxFiles
	}
	directory, err := config.CommentsDirectory()
	if err != nil {
		return err
	}
	path := filepath.Join(directory, "sadoku.sqlite3")
	database, err := db.Open(path)
	if err != nil {
		return err
	}
	defer database.Close()
	repo := &storage.Repository{DB: database, Path: path}
	s, err := session.New(ctx, options.Source, repo, settings)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("Markdown file or directory not found: %s", source)
		}
		return err
	}
	return startSession(ctx, options, out, s, settings)
}

func startSession(ctx context.Context, options cli.StartOptions, out io.Writer, s *session.Session, settings config.Settings) error {
	_, source, _ := session.Source(options.Source)
	if s.GitHub != nil {
		source = s.GitHub.URL
	}
	log := func(message string) { fmt.Fprintf(out, "[%s] %s\n", db.Now(), message) }

	if !s.CanCreate {
		for _, doc := range s.Documents {
			path := doc.FilePath
			if s.GitHub != nil {
				path = s.Sources[doc.ID]
			} else {
				path = source
			}
			suffix := ""
			if doc.Deleted {
				suffix = " (saved snapshot)"
			}
			log(fmt.Sprintf("Registered document: id=%d path=%s%s", doc.ID, path, suffix))
		}
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	var mu sync.Mutex
	streams := 0
	var timer *time.Timer
	handler, err := httpadapter.New(s, httpadapter.Options{TrustForwardedPrefix: options.TrustForwardedPrefix, Log: log, OnStreamOpen: func() {
		mu.Lock()
		defer mu.Unlock()
		streams++
		if timer != nil {
			timer.Stop()
			timer = nil
		}
	}, OnStreamClose: func() {
		mu.Lock()
		defer mu.Unlock()
		streams--
		if streams == 0 && !options.KeepAlive {
			timer = time.AfterFunc(3*time.Second, func() {
				mu.Lock()
				defer mu.Unlock()
				if streams == 0 {
					log("Stopping preview server after browser tab closed: " + source)
					cancel()
				}
			})
		}
	}})
	if err != nil {
		return err
	}
	var listener net.Listener
	for port := options.Port; port <= 65535; port++ {
		listener, err = net.Listen("tcp", net.JoinHostPort(options.Host, fmt.Sprint(port)))
		if err == nil {
			break
		}
		if port-options.Port >= 100 {
			return err
		}
	}
	if err != nil {
		return err
	}
	defer listener.Close()
	pathname := "/"
	if !s.CanCreate && s.GitHub == nil && len(s.Documents) > 0 {
		pathname = fmt.Sprintf("/documents/%d", s.Documents[0].ID)
	}
	previewURL := "http://" + listener.Addr().String() + pathname
	log("Serving " + source)
	log("Preview: " + previewURL)

	server := &http.Server{Handler: handler, ReadHeaderTimeout: 10 * time.Second, BaseContext: func(net.Listener) context.Context { return ctx }}
	var tasks sync.WaitGroup
	tasks.Add(2)
	go func() { defer tasks.Done(); s.Prepare(ctx, settings) }()
	go func() {
		defer tasks.Done()
		s.Monitor(ctx, settings, func(err error) {
			fmt.Fprintf(os.Stderr, "[%s] Failed to check GitHub pull request for updates: %s\n", db.Now(), err)
		})
	}()
	defer func() { cancel(); tasks.Wait() }()

	if options.Open {
		go func() {
			if browserErr := cli.OpenBrowser(previewURL); browserErr != nil {
				fmt.Fprintf(os.Stderr, "[%s] Failed to open browser automatically: %s\n", db.Now(), browserErr)
			}
		}()
	}
	done := make(chan struct{})
	shutdownDone := make(chan struct{})
	go func() {
		defer close(shutdownDone)
		select {
		case <-ctx.Done():
			shutdownCtx, stop := context.WithTimeout(context.Background(), 5*time.Second)
			defer stop()
			server.Shutdown(shutdownCtx)
		case <-done:
		}
	}()
	err = server.Serve(listener)
	close(done)
	cancel()
	<-shutdownDone
	mu.Lock()
	if timer != nil {
		timer.Stop()
	}
	mu.Unlock()
	if err == http.ErrServerClosed {
		return nil
	}
	return err
}
