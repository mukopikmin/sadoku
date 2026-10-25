package server

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
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
		return err
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	monitorDone := make(chan struct{})
	go func() {
		defer close(monitorDone)
		s.Monitor(ctx, settings, func(err error) { fmt.Fprintf(out, "Failed to check GitHub updates: %s\n", err) })
	}()
	defer func() { cancel(); <-monitorDone }()
	var mu sync.Mutex
	streams := 0
	var timer *time.Timer
	handler, err := httpadapter.New(s, httpadapter.Options{TrustForwardedPrefix: options.TrustForwardedPrefix, OnStreamOpen: func() {
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
	previewURL := "http://" + listener.Addr().String()
	fmt.Fprintf(out, "Serving %s\nPreview: %s\n", options.Source, previewURL)

	server := &http.Server{Handler: handler, ReadHeaderTimeout: 10 * time.Second, BaseContext: func(net.Listener) context.Context { return ctx }}
	if options.Open {
		go func() {
			if browserErr := cli.OpenBrowser(previewURL); browserErr != nil {
				fmt.Fprintf(out, "Could not open browser: %s\n", browserErr)
			}
		}()
	}
	done := make(chan struct{})
	go func() {
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
