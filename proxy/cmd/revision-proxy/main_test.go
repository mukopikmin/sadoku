package main

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestConfigure(t *testing.T) {
	base := map[string]string{
		"BACKEND_SERVICE_URL": "https://backend-opaque.a.run.app",
		"PUBLIC_ORIGIN":       "https://preview.example.com",
	}
	for _, test := range []struct {
		name, key, value, address string
		invalid                   bool
	}{
		{name: "local defaults", address: "127.0.0.1:8080"},
		{name: "container bind", key: "LISTEN_HOST", value: "0.0.0.0", address: "0.0.0.0:8080"},
		{name: "IPv6", key: "LISTEN_HOST", value: "::1", address: "[::1]:8080"},
		{name: "Cloud Run port", key: "PORT", value: "9090", address: "127.0.0.1:9090"},
		{name: "hostname", key: "LISTEN_HOST", value: "attacker.example", invalid: true},
		{name: "port zero", key: "PORT", value: "0", invalid: true},
		{name: "large port", key: "PORT", value: "65536", invalid: true},
		{name: "signed port", key: "PORT", value: "+8080", invalid: true},
		{name: "port whitespace", key: "PORT", value: "8080 ", invalid: true},
		{name: "missing backend", key: "BACKEND_SERVICE_URL", invalid: true},
		{name: "arbitrary backend", key: "BACKEND_SERVICE_URL", value: "https://attacker.example", invalid: true},
		{name: "missing origin", key: "PUBLIC_ORIGIN", invalid: true},
		{name: "HTTP origin", key: "PUBLIC_ORIGIN", value: "http://preview.example.com", invalid: true},
		{name: "invalid audience", key: "IAM_AUDIENCE", value: "https://attacker.example", invalid: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			address, handler, err := configure(func(key string) string {
				if key == test.key {
					return test.value
				}
				return base[key]
			})
			if test.invalid {
				if err == nil || handler != nil {
					t.Fatal("invalid configuration accepted")
				}
				return
			}
			if err != nil || handler == nil || address != test.address {
				t.Fatalf("configure = %q, handler present %v, %v", address, handler != nil, err)
			}
		})
	}
}

func TestServerDrainsActiveResponse(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	release := make(chan struct{})
	defer close(release)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() {
		done <- serve(ctx, listener, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			io.WriteString(w, "data: first\n\n")
			w.(http.Flusher).Flush()
			select {
			case <-release:
			case <-r.Context().Done():
			}
			io.WriteString(w, "data: last\n\n")
		}), testLogger(), time.Second)
	}()
	client := &http.Client{Timeout: 3 * time.Second, Transport: &http.Transport{Proxy: nil}}
	defer client.CloseIdleConnections()
	response, err := client.Get("http://" + listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	first := make([]byte, len("data: first\n\n"))
	if _, err := io.ReadFull(response.Body, first); err != nil || string(first) != "data: first\n\n" {
		t.Fatalf("first SSE event = %q, %v", first, err)
	}
	cancel()
	select {
	case err := <-done:
		t.Fatalf("server exited before active response finished: %v", err)
	case <-time.After(20 * time.Millisecond):
	}
	release <- struct{}{}
	last, err := io.ReadAll(response.Body)
	if err != nil || string(last) != "data: last\n\n" {
		t.Fatalf("remaining response = %q, %v", last, err)
	}
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("server did not shut down")
	}
}

func TestShutdownBoundsLongLivedResponse(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	closed := make(chan struct{})
	go func() {
		done <- serve(ctx, listener, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.(http.Flusher).Flush()
			<-r.Context().Done()
			close(closed)
		}), testLogger(), 30*time.Millisecond)
	}()
	client := &http.Client{Timeout: 3 * time.Second, Transport: &http.Transport{Proxy: nil}}
	defer client.CloseIdleConnections()
	response, err := client.Get("http://" + listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	cancel()
	select {
	case err := <-done:
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("shutdown = %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("shutdown exceeded grace period")
	}
	select {
	case <-closed:
	case <-time.After(time.Second):
		t.Fatal("active connection was not closed")
	}
}

func TestRunRejectsConfigurationBeforeListening(t *testing.T) {
	var logs strings.Builder
	err := run(context.Background(), func(string) string { return "" }, slog.New(slog.NewTextHandler(&logs, nil)))
	if err == nil || logs.Len() != 0 {
		t.Fatalf("run = %v, logs = %q", err, logs.String())
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}
