package server

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mukopikmin/sadoku/src/server/cli"
	"github.com/ncruces/go-sqlite3"
)

type previewOutput struct {
	mu    sync.Mutex
	lines []string
	ready chan string
}

func (o *previewOutput) Write(b []byte) (int, error) {
	o.mu.Lock()
	defer o.mu.Unlock()
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		o.lines = append(o.lines, line)
		if _, url, ok := strings.Cut(line, "] Preview: "); ok {
			o.ready <- url
		}
	}
	return len(b), nil
}
func TestPreviewCommandOutput(t *testing.T) {
	// Compile the SQLite Wasm module before measuring server readiness. Cold
	// compilation can exceed ten seconds on a busy race-test runner.
	if err := sqlite3.Initialize(); err != nil {
		t.Fatal(err)
	}
	for _, directory := range []bool{false, true} {
		t.Run(fmt.Sprintf("directory=%v", directory), func(t *testing.T) {
			root := t.TempDir()
			file := filepath.Join(root, "doc.md")
			if err := os.WriteFile(file, []byte("# Test\n"), 0600); err != nil {
				t.Fatal(err)
			}
			t.Setenv("SADOKU_COMMENTS_DIR", filepath.Join(root, "comments"))
			t.Setenv("XDG_CONFIG_HOME", filepath.Join(root, "config"))
			t.Setenv("APPDATA", "")
			source := file
			if directory {
				source = root
			}
			output := &previewOutput{ready: make(chan string, 1)}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			done := make(chan error, 1)
			go func() {
				done <- Start(ctx, cli.StartOptions{Source: source, Host: "127.0.0.1", KeepAlive: true}, output)
			}()
			var url string
			select {
			case url = <-output.ready:
			case err := <-done:
				t.Fatalf("startup: %v", err)
			case <-time.After(10 * time.Second):
				t.Fatal("startup timed out")
			}
			cancel()
			select {
			case err := <-done:
				if err != nil {
					t.Fatal(err)
				}
			case <-time.After(10 * time.Second):
				t.Fatal("shutdown timed out")
			}
			suffix := "/documents/1"
			if directory {
				suffix = "/"
			}
			if !strings.HasSuffix(url, suffix) {
				t.Fatalf("URL: %s", url)
			}
			timestamp := regexp.MustCompile(`^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] `)
			want := []string{"Serving " + source, "Preview: " + url}
			if !directory {
				want = append([]string{"Registered document: id=1 path=" + file}, want...)
			}
			output.mu.Lock()
			defer output.mu.Unlock()
			if len(output.lines) != len(want) {
				t.Fatalf("logs: %q", output.lines)
			}
			for i, line := range output.lines {
				if !timestamp.MatchString(line) || timestamp.ReplaceAllString(line, "") != want[i] {
					t.Errorf("log %d: %q, want timestamp + %q", i, line, want[i])
				}
			}
		})
	}
}
