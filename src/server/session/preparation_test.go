package session

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/mukopikmin/sadoku/src/server/db"
	"github.com/mukopikmin/sadoku/src/server/storage"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

type snapshotRepository struct {
	u.Repository
	failID int64
}

func (r snapshotRepository) InitializeSnapshotContext(ctx context.Context, id int64, markdown string) error {
	if id == r.failID {
		return errors.New("snapshot write failed")
	}
	return r.Repository.InitializeSnapshotContext(ctx, id, markdown)
}
func snapshotSession(t *testing.T, count int) (*Session, *storage.Repository) {
	t.Helper()
	root := t.TempDir()
	path := filepath.Join(root, "sadoku.sqlite3")
	database, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { database.Close() })
	repo := &storage.Repository{DB: database, Path: path}
	s := &Session{Repository: repo, Sources: map[int64]string{}}
	for i := 1; i <= count; i++ {
		source := filepath.Join(root, fmt.Sprintf("%d.md", i))
		doc, err := repo.Ensure(source)
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
		snapshot, _, err := repo.Snapshot(id)
		if err != nil || snapshot == nil {
			t.Fatalf("later snapshot %d: %v %v", id, snapshot, err)
		}
	}
}
func TestBackgroundSnapshotPreservesContentSavedDuringItsRead(t *testing.T) {
	s, repo := snapshotSession(t, 1)
	s.ReadRemote = func(ctx context.Context, source string) (string, error) {
		if err := repo.InitializeSnapshotContext(ctx, 1, "newer displayed content"); err != nil {
			return "", err
		}
		return "older background content", nil
	}
	if progress := s.InitializeSnapshots(context.Background()); progress.Completed != 1 {
		t.Fatalf("queue: %+v", progress)
	}
	snapshot, _, err := repo.Snapshot(1)
	if err != nil || snapshot == nil || *snapshot != "newer displayed content" {
		t.Fatalf("snapshot overwritten: %v %v", snapshot, err)
	}
	history, err := repo.Revisions(1)
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
