package cli

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestCLIRejectsInvalidOptionsBeforeWriting(t *testing.T) {
	root := t.TempDir()
	t.Setenv("SADOKU_COMMENTS_DIR", filepath.Join(root, "comments"))
	for _, args := range [][]string{{"start", "README.md", "--as-bot"}, {"document", "add", "x.md", "--title", "bad\ntitle"}, {"comment", "add", "--source", "x.md", "--ensure-document", "--start-line", "2", "--end-line", "1", "--body", "x"}, {"comment", "reply", "add", "--source", "x.md", "--comment", "1", "--body", "x", "--request-review"}, {"tag", "add", "--name", "x", "extra"}, {"memory", "delete", "1", "--source", "x.md", "--content", "x"}} {
		if err := Execute(context.Background(), args, &bytes.Buffer{}, nil); err == nil {
			t.Fatalf("accepted %v", args)
		}
	}
	if _, err := os.Stat(filepath.Join(root, "comments")); !os.IsNotExist(err) {
		t.Fatal("invalid command wrote a database", err)
	}
}

func TestNoSyncStartOptions(t *testing.T) {
	for _, flags := range [][]string{{"--no-sync"}, {"--no-sync", "--keep-alive"}} {
		called := false
		err := Execute(context.Background(), append([]string{"start", "README.md"}, flags...), &bytes.Buffer{}, func(_ context.Context, o StartOptions) error {
			called = true
			if !o.NoSync || o.KeepAlive != (len(flags) == 2) {
				t.Fatalf("unexpected options: %+v", o)
			}
			return nil
		})
		if err != nil || !called {
			t.Fatalf("start: %v", err)
		}
	}
	if err := Execute(context.Background(), []string{"update", "--no-sync"}, &bytes.Buffer{}, nil); err == nil {
		t.Fatal("accepted preview option on update")
	}
}
