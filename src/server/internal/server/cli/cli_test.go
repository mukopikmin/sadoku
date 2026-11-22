package cli

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/mukopikmin/sadoku/internal/server/config"
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
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("APPDATA", "")
	for _, flags := range [][]string{{"--no-sync"}, {"--no-sync", "--keep-alive"}} {
		called := false
		err := Execute(context.Background(), append([]string{"start", "README.md"}, flags...), &bytes.Buffer{}, func(_ context.Context, o StartOptions, _ config.Settings) error {
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

func TestStartDefaults(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("APPDATA", "")
	checkStart := func(t *testing.T, args []string, want StartOptions, depth, files int) {
		t.Helper()
		called := false
		err := Execute(context.Background(), args, &bytes.Buffer{}, func(_ context.Context, options StartOptions, settings config.Settings) error {
			called = true
			if !reflect.DeepEqual(options, want) {
				t.Errorf("start options = %+v, want %+v", options, want)
			}
			if settings.MaxDepth != depth || settings.MaxFiles != files {
				t.Errorf("directory settings = (%d, %d), want (%d, %d)", settings.MaxDepth, settings.MaxFiles, depth, files)
			}
			return nil
		})
		if err != nil || !called {
			t.Fatalf("start: called=%t, err=%v", called, err)
		}
	}
	args := []string{"start", "README.md"}
	checkStart(t, args, StartOptions{Source: "README.md", Host: "127.0.0.1", Port: 3334, Open: true}, 2, 20)
	if err := config.AtomicWrite(config.Path(), []byte(`directory_max_depth = 3
directory_max_files = 12
custom = "keep"

[start]
host = "localhost"
port = 4000
no_open = true
keep_alive = true
no_sync = true
trust_forwarded_prefix = true
`), 0600); err != nil {
		t.Fatal(err)
	}
	configured := StartOptions{Source: "README.md", Host: "localhost", Port: 4000, KeepAlive: true, NoSync: true, TrustForwardedPrefix: true}
	checkStart(t, args, configured, 3, 12)

	t.Run("override port and no-open", func(t *testing.T) {
		expected := configured
		expected.Port = 3334
		expected.Open = true
		checkStart(t, []string{"--no-open=false", "start", "README.md", "-p3334"}, expected, 3, 12)
	})
	t.Run("override host, booleans and directory limits", func(t *testing.T) {
		depth, files := 0, 1
		expected := StartOptions{Source: "README.md", Host: "127.0.0.1", Port: 4000, MaxDepth: &depth, MaxFiles: &files}
		checkStart(t, []string{"start", "README.md", "--host=127.0.0.1", "--keep-alive=false", "--no-sync=false",
			"--trust-forwarded-prefix=false", "--max-depth=0", "--max-files=1"}, expected, 3, 12)
	})
	checkStart(t, args, configured, 3, 12)
}

func TestStartRejectsInvalidDefaults(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("APPDATA", "")
	for _, test := range []struct{ name, contents, diagnostic string }{
		{"syntax", "[start]\nport = @", ":2:8: toml:"},
		{"unknown key", "[start]\nprot = 4000", `: unknown setting "start.prot"`},
		{"misplaced limit", "[start]\ndirectory_max_depth = 1", `: unknown setting "start.directory_max_depth"`},
		{"table type", "start = true", ": start must be a table"},
		{"host type", "[start]\nhost = true", ": start.host must be a non-empty string"},
		{"empty host", "[start]\nhost = ''", ": start.host must be a non-empty string"},
		{"port type", "[start]\nport = '4000'", ": start.port must be an integer between 1 and 65535"},
		{"port low", "[start]\nport = 0", ": start.port must be an integer between 1 and 65535"},
		{"port high", "[start]\nport = 65536", ": start.port must be an integer between 1 and 65535"},
		{"boolean type", "[start]\nno_open = 'true'", ": start.no_open must be a boolean"},
		{"invalid directory limit", "directory_max_files = 0", ": directory_max_files in Sadoku config must be a positive integer."},
	} {
		t.Run(test.name, func(t *testing.T) {
			if err := config.AtomicWrite(config.Path(), []byte(test.contents), 0600); err != nil {
				t.Fatal(err)
			}
			err := Execute(context.Background(), []string{"start", "README.md", "--port", "4500"}, &bytes.Buffer{}, func(context.Context, StartOptions, config.Settings) error {
				t.Fatal("started with an invalid configuration")
				return nil
			})
			if err == nil {
				t.Fatal("missing configuration error")
			}
			var stderr bytes.Buffer
			WriteError(&stderr, err)
			if want := config.Path() + test.diagnostic; !strings.HasPrefix(stderr.String(), want) {
				t.Fatalf("stderr = %q, want prefix %q", stderr.String(), want)
			}
			if err := Execute(context.Background(), []string{"start", "--help"}, &bytes.Buffer{}, nil); err != nil {
				t.Fatalf("help failed with invalid start settings: %v", err)
			}
		})
	}
}
