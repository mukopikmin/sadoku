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
	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	"github.com/mukopikmin/sadoku/src/server/session"
	"github.com/mukopikmin/sadoku/src/server/storage"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

type previewOutput struct {
	mu    sync.Mutex
	lines []string
	ready chan string
}

func TestGitHubPreviewLogsCanonicalTargetAndImmutableSource(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "db.sqlite3")
	database, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	repo := &storage.Repository{DB: database, Path: path}
	const target = "https://github.com/owner/repo/pull/1"
	const contentURL = "https://api.github.com/repos/owner/repo/contents/readme.md?ref=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	doc, err := repo.Ensure(target + "/files/readme.md")
	if err != nil {
		t.Fatal(err)
	}
	s := &session.Session{Repository: repo, GitHub: &session.Pull{URL: target}, Documents: []u.Document{doc}, Sources: map[int64]string{doc.ID: contentURL}, ReadRemote: func(context.Context, string) (string, error) { return "# Test\n", nil }}
	output := &previewOutput{ready: make(chan string, 1)}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() {
		done <- startSession(ctx, cli.StartOptions{Source: target + "?token=private#files", Host: "127.0.0.1", KeepAlive: true}, output, s, config.Defaults())
	}()
	var previewURL string
	select {
	case previewURL = <-output.ready:
	case err := <-done:
		t.Fatalf("preview start: %v", err)
	case <-time.After(10 * time.Second):
		t.Fatal("preview did not start")
	}
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("preview did not stop")
	}
	want := []string{"Registered document: id=1 path=" + contentURL, "Serving " + target, "Preview: " + previewURL}
	if len(output.lines) != len(want) {
		t.Fatalf("preview logs: %q", output.lines)
	}
	for i, line := range output.lines {
		_, message, ok := strings.Cut(line, "] ")
		if !ok || message != want[i] {
			t.Errorf("log %d: %q; want timestamp + %q", i, line, want[i])
		}
	}
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
