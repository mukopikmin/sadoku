// Command revision-proxy serves the revision path proxy on Cloud Run.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/mukopikmin/sadoku/proxy"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, os.Getenv, logger); err != nil {
		logger.Error("Proxy stopped", "error", err)
		os.Exit(1)
	}
}

func configure(getenv func(string) string) (string, http.Handler, error) {
	host := getenv("LISTEN_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	if net.ParseIP(host) == nil {
		return "", nil, errors.New("LISTEN_HOST must be an IP address")
	}
	port := getenv("PORT")
	if port == "" {
		port = "8080"
	}
	number, err := strconv.Atoi(port)
	if err != nil || number < 1 || number > 65535 || strings.Trim(port, "0123456789") != "" {
		return "", nil, errors.New("PORT must be an integer between 1 and 65535")
	}
	handler, err := proxy.New(proxy.Options{
		BackendServiceURL: getenv("BACKEND_SERVICE_URL"),
		PublicOrigin:      getenv("PUBLIC_ORIGIN"),
		IAMAudience:       getenv("IAM_AUDIENCE"),
	})
	if err != nil {
		return "", nil, fmt.Errorf("invalid proxy configuration: %w", err)
	}
	return net.JoinHostPort(host, port), handler, nil
}

func run(ctx context.Context, getenv func(string) string, logger *slog.Logger) error {
	address, handler, err := configure(getenv)
	if err != nil {
		return err
	}
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	logger.Info("Proxy listening", "address", listener.Addr().String())
	// Cloud Run allows 10 seconds between SIGTERM and SIGKILL.
	return serve(ctx, listener, handler, logger, 8*time.Second)
}

func serve(ctx context.Context, listener net.Listener, handler http.Handler, logger *slog.Logger, grace time.Duration) error {
	server := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
		// No whole-request read/write deadline: uploads and SSE may be long-lived.
	}
	defer server.Close()
	finished := make(chan error, 1)
	go func() { finished <- server.Serve(listener) }()
	select {
	case err := <-finished:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		logger.Info("Proxy shutting down")
		deadline, cancel := context.WithTimeout(context.Background(), grace)
		defer cancel()
		if err := server.Shutdown(deadline); err != nil {
			return fmt.Errorf("shutdown: %w", err)
		}
		return nil
	}
}
