package session

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	"github.com/mukopikmin/sadoku/src/server/storage"
)

func TestDirectoryDiscoveryHonorsLimitsAndRetainsDeletedSnapshots(t *testing.T) {
	root := t.TempDir()
	docs := filepath.Join(root, "docs")
	database, err := db.Open(filepath.Join(root, "app.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	repo := &storage.Repository{DB: database}
	for _, name := range []string{"a.md", "b.MARKDOWN", "ignored.txt", "nested/c.md", "nested/deep/d.md", ".git/hidden.md", "node_modules/hidden.md"} {
		path := filepath.Join(docs, filepath.FromSlash(name))
		if err = os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			t.Fatal(err)
		}
		if err = os.WriteFile(path, []byte("# "+name), 0600); err != nil {
			t.Fatal(err)
		}
	}
	settings := config.Defaults()
	settings.MaxDepth = 1
	s, err := New(context.Background(), docs, repo, settings)
	if err != nil {
		t.Fatal(err)
	}
	s.Prepare(context.Background(), settings)
	if !s.CanCreate || len(s.Documents) != 3 {
		t.Fatalf("discovered documents %+v", s.Documents)
	}
	for _, d := range s.Documents {
		if d.RelativePath != "a.md" && d.RelativePath != "b.MARKDOWN" && d.RelativePath != "nested/c.md" {
			t.Fatalf("discovered excluded file: %+v", d)
		}
	}
	if err = os.Remove(filepath.Join(docs, "a.md")); err != nil {
		t.Fatal(err)
	}
	s, err = New(context.Background(), docs, repo, settings)
	if err != nil {
		t.Fatal(err)
	}
	s.Prepare(context.Background(), settings)
	deleted := false
	for _, d := range s.Documents {
		if d.RelativePath == "a.md" {
			snapshot, _, err := repo.Snapshot(d.ID)
			if err != nil || snapshot == nil || *snapshot != "# a.md" || !d.Deleted {
				t.Fatalf("deleted snapshot %+v %v", d, err)
			}
			deleted = true
		}
	}
	if !deleted {
		t.Fatal("deleted document disappeared from the session")
	}
	settings.MaxFiles = 1
	s, err = New(context.Background(), docs, repo, settings)
	if err != nil {
		t.Fatal(err)
	}
	s.Prepare(context.Background(), settings)
	if len(s.Documents) != 1 {
		t.Fatalf("file limit %+v %v", s, err)
	}
}
func TestLocalDestinationRejectsTraversalAndSymlinks(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	if err := SafeLocal(root, filepath.Join(root, "..", "outside.md"), true); err == nil {
		t.Fatal("accepted traversal")
	}
	if err := SafeLocal(root, filepath.Join(root, "new.md"), true); err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS == "windows" {
		t.Skip("symlink creation requires Windows privileges")
	}
	if err := os.Symlink(outside, filepath.Join(root, "linked")); err != nil {
		t.Fatal(err)
	}
	if err := SafeLocal(root, filepath.Join(root, "linked", "new.md"), true); err == nil {
		t.Fatal("accepted linked directory")
	}
	file := filepath.Join(outside, "file.md")
	if err := os.WriteFile(file, []byte("outside"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(file, filepath.Join(root, "file.md")); err != nil {
		t.Fatal(err)
	}
	if err := SafeLocal(root, filepath.Join(root, "file.md"), true); err == nil {
		t.Fatal("accepted linked file")
	}
	// A selected root may itself resolve through a platform-provided alias.
	alias := filepath.Join(t.TempDir(), "root")
	if err := os.Symlink(root, alias); err != nil {
		t.Fatal(err)
	}
	destination, err := ResolveLocal(alias, filepath.Join(alias, "safe.md"), true)
	realRoot, _ := filepath.EvalSymlinks(root)
	if err != nil || destination != filepath.Join(realRoot, "safe.md") {
		t.Fatal(destination, err)
	}
}
