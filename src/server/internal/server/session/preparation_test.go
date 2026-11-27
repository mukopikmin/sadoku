package session

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/mukopikmin/sadoku/internal/server/config"
	"github.com/mukopikmin/sadoku/internal/server/db"
	"github.com/mukopikmin/sadoku/internal/server/storage"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

type snapshotRepository struct {
	u.Repository
	failID int64
}

func (r snapshotRepository) InitializeSnapshot(ctx context.Context, id int64, markdown string) error {
	if id == r.failID {
		return errors.New("snapshot write failed")
	}
	return r.Repository.InitializeSnapshot(ctx, id, markdown)
}
func snapshotSession(t *testing.T, count int) (*Session, *storage.Repository) {
	t.Helper()
	root := t.TempDir()
	path := filepath.Join(root, "sadoku.sqlite3")
	database, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })
	repo := &storage.Repository{DB: database, Path: path}
	s := &Session{Repository: repo, Sources: map[int64]string{}}
	for i := 1; i <= count; i++ {
		source := filepath.Join(root, fmt.Sprintf("%d.md", i))
		doc, err := repo.Ensure(t.Context(), source)
		if err != nil {
			t.Fatal(err)
		}
		s.Documents = append(s.Documents, doc)
		s.Sources[doc.ID] = source
	}
	return s, repo
}
func TestBackgroundSnapshotsContinueAfterFailuresAndSkipDeletedFiles(t *testing.T) {
	s, repo := snapshotSession(t, 5)
	s.Documents[4].Deleted = true
	s.Repository = snapshotRepository{Repository: repo, failID: 3}
	reads := []string{}
	s.ReadRemote = func(ctx context.Context, source string) (string, error) {
		name := filepath.Base(source)
		reads = append(reads, name)
		if name == "2.md" {
			return "", errors.New("read failed")
		}
		return name, nil
	}
	progress := s.InitializeSnapshots(context.Background())
	if progress.Target != 4 || progress.Completed != 2 || progress.Failed != 2 {
		t.Fatalf("queue: %+v", progress)
	}
	if len(reads) != 4 || reads[0] != "1.md" || reads[3] != "4.md" {
		t.Fatalf("read order/deleted file: %v", reads)
	}
	for _, id := range []int64{1, 4} {
		snapshot, _, err := repo.Snapshot(t.Context(), id)
		if err != nil || snapshot == nil {
			t.Fatalf("later snapshot %d: %v %v", id, snapshot, err)
		}
	}
}
func TestBackgroundSnapshotPreservesContentSavedDuringItsRead(t *testing.T) {
	s, repo := snapshotSession(t, 1)
	s.ReadRemote = func(ctx context.Context, source string) (string, error) {
		if err := repo.InitializeSnapshot(ctx, 1, "newer displayed content"); err != nil {
			return "", err
		}
		return "older background content", nil
	}
	if progress := s.InitializeSnapshots(context.Background()); progress.Completed != 1 {
		t.Fatalf("queue: %+v", progress)
	}
	snapshot, _, err := repo.Snapshot(t.Context(), 1)
	if err != nil || snapshot == nil || *snapshot != "newer displayed content" {
		t.Fatalf("snapshot overwritten: %v %v", snapshot, err)
	}
	history, err := repo.Revisions(t.Context(), 1)
	if err != nil || len(history) != 1 {
		t.Fatalf("extra archival revision: %+v %v", history, err)
	}
}
func TestBackgroundSnapshotsDoNotStartAnotherFileAfterCancellation(t *testing.T) {
	s, _ := snapshotSession(t, 3)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	reads := 0
	s.ReadRemote = func(ctx context.Context, source string) (string, error) { reads++; cancel(); return "first", nil }
	s.InitializeSnapshots(ctx)
	if reads != 1 {
		t.Fatalf("read %d files after cancellation", reads)
	}
}

func TestReloadKeepsFilesCreatedPastDiscoveryLimit(t *testing.T) {
	_, repo := snapshotSession(t, 0)
	root := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("APPDATA", "")
	settings := config.Defaults()
	settings.MaxFiles = 1
	if err := os.WriteFile(filepath.Join(root, "existing.md"), []byte("# Existing"), 0600); err != nil {
		t.Fatal(err)
	}
	s, err := New(t.Context(), root, repo, settings)
	if err != nil {
		t.Fatal(err)
	}
	s.Prepare(t.Context(), settings)
	created, err := s.CreateDocument(t.Context(), "", "created.md", "Saved title")
	if err != nil {
		t.Fatal(err)
	}
	for _, deleted := range []bool{false, true} {
		if deleted {
			if err := os.Remove(filepath.Join(root, "created.md")); err != nil {
				t.Fatal(err)
			}
		}
		if err := s.ReloadDocuments(t.Context()); err != nil {
			t.Fatal(err)
		}
		docs, err := s.ListDocuments(t.Context(), false)
		if err != nil || len(docs) != 2 || docs[1].RelativePath != "existing.md" ||
			docs[0].ID != created.ID || docs[0].Deleted != deleted ||
			docs[0].DisplayTitle == nil || *docs[0].DisplayTitle != "Saved title" {
			t.Fatalf("documents after reload (deleted=%t): %+v %v", deleted, docs, err)
		}
	}
}

func TestReloadRetriesMissingSnapshot(t *testing.T) {
	_, repo := snapshotSession(t, 0)
	root := t.TempDir()
	settings := config.Defaults()
	s, err := New(t.Context(), root, repo, settings)
	if err != nil {
		t.Fatal(err)
	}
	s.Prepare(t.Context(), settings)
	path := filepath.Join(root, "added.md")
	if err := os.WriteFile(path, []byte("# Saved"), 0600); err != nil {
		t.Fatal(err)
	}
	doc, err := repo.Ensure(t.Context(), path)
	if err != nil {
		t.Fatal(err)
	}
	s.Repository = snapshotRepository{Repository: repo, failID: doc.ID}
	if err := s.ReloadDocuments(t.Context()); err != nil {
		t.Fatal(err)
	}
	if snapshot, _, err := repo.Snapshot(t.Context(), doc.ID); err != nil || snapshot != nil {
		t.Fatalf("snapshot should be missing after write failure: %v %v", snapshot, err)
	}
	s.Repository = repo
	if err := s.ReloadDocuments(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := s.ReloadDocuments(t.Context()); err != nil {
		t.Fatal(err)
	}
	deleted, err := s.GetDocument(t.Context(), doc.ID)
	if err != nil || !deleted.Deleted || deleted.Markdown != "# Saved" {
		t.Fatalf("saved copy after deletion: %+v %v", deleted, err)
	}
}
