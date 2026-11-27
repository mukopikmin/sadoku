package session

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/mukopikmin/sadoku/internal/server/config"
	"github.com/mukopikmin/sadoku/internal/server/db"
	"github.com/mukopikmin/sadoku/internal/server/storage"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

type failedRegistration struct {
	u.Repository
	stage string
}

func TestInvokeCancelsWhileWaitingForDatabaseConnection(t *testing.T) {
	repo := directoryRepository(t)
	conn, err := repo.DB.Conn(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.Close() }()
	s := &Session{Repository: repo}
	ctx, cancel := context.WithTimeout(t.Context(), 100*time.Millisecond)
	defer cancel()
	done := make(chan error, 1)
	go func() {
		_, err := s.Invoke(ctx, "GetStatistics", Input{})
		done <- err
	}()
	select {
	case err := <-done:
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("operation error = %v, want expired deadline", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("canceled operation kept waiting for the database connection")
	}
}

func (r failedRegistration) Ensure(ctx context.Context, path string) (u.Document, error) {
	if r.stage == "ensure" {
		return u.Document{}, errors.New("registration failed")
	}
	return r.Repository.Ensure(ctx, path)
}
func (r failedRegistration) SetTitle(ctx context.Context, id int64, title *string) error {
	if r.stage == "title" {
		return errors.New("title failed")
	}
	return r.Repository.SetTitle(ctx, id, title)
}
func (r failedRegistration) InitializeSnapshot(ctx context.Context, id int64, markdown string) error {
	if r.stage == "snapshot" {
		return errors.New("snapshot failed")
	}
	return r.Repository.InitializeSnapshot(ctx, id, markdown)
}

func TestCreationReportsTheSavedFileWhenRegistrationFails(t *testing.T) {
	for _, stage := range []string{"ensure", "title", "snapshot"} {
		t.Run(stage, func(t *testing.T) {
			directory := t.TempDir()
			root := filepath.Join(directory, "docs")
			if err := os.Mkdir(root, 0700); err != nil {
				t.Fatal(err)
			}
			t.Setenv("XDG_CONFIG_HOME", filepath.Join(directory, "config"))
			t.Setenv("APPDATA", "")
			database, err := db.Open(filepath.Join(directory, "db.sqlite3"))
			if err != nil {
				t.Fatal(err)
			}
			defer func() { _ = database.Close() }()
			s, err := New(context.Background(), root, &storage.Repository{DB: database}, config.Defaults())
			if err != nil {
				t.Fatal(err)
			}
			s.Prepare(context.Background(), config.Defaults())
			s.Repository = failedRegistration{s.Repository, stage}
			_, err = s.CreateDocument(context.Background(), "", "saved", "Title")
			var failure *u.Failure
			if !errors.As(err, &failure) || failure.Kind != "internal" || failure.Message != "The file was created, but could not be added to the preview. Reload the document list to load it." {
				t.Fatalf("registration failure: %v", err)
			}
			contents, err := os.ReadFile(filepath.Join(root, "saved.md"))
			if err != nil || len(contents) != 0 {
				t.Fatalf("created file was lost: %q %v", contents, err)
			}
			if len(s.Documents) != 0 {
				t.Fatal("partially registered document was published")
			}
		})
	}
}

type blockedRevision struct {
	u.Repository
	entered, release chan struct{}
}

func (r blockedRevision) Revision(ctx context.Context, documentID, revisionID int64) (u.Revision, error) {
	close(r.entered)
	<-r.release
	return r.Repository.Revision(ctx, documentID, revisionID)
}

func TestConcurrentRestoreReportsBusyAndClearsAfterCompletion(t *testing.T) {
	root := t.TempDir()
	file := filepath.Join(root, "restore.md")
	if err := os.WriteFile(file, []byte("Current"), 0600); err != nil {
		t.Fatal(err)
	}
	repo := directoryRepository(t)
	s, err := New(context.Background(), file, repo, config.Defaults())
	if err != nil {
		t.Fatal(err)
	}
	s.InitializeSnapshots(context.Background())
	revisions, err := repo.Revisions(t.Context(), s.Documents[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	entered, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	t.Cleanup(unblock)
	s.Repository = blockedRevision{repo, entered, release}
	expected := "Current"
	id, revisionID := s.Documents[0].ID, revisions[0].ID
	done := make(chan error, 1)
	go func() { err := s.RestoreDocumentRevision(context.Background(), id, revisionID, &expected); done <- err }()
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("restore did not start")
	}
	second := make(chan error, 1)
	go func() {
		err := s.RestoreDocumentRevision(context.Background(), id, revisionID, &expected)
		second <- err
	}()
	select {
	case err := <-second:
		var failure *u.Failure
		if !errors.As(err, &failure) || failure.Kind != "aborted" || failure.Message != "A restore is already in progress." {
			t.Fatalf("second restore: %v", err)
		}
	case <-time.After(time.Second):
		unblock()
		_ = <-done
		t.Fatal("second restore waited instead of reporting busy")
	}
	unblock()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	s.Repository = repo
	if err := s.RestoreDocumentRevision(context.Background(), id, revisionID, &expected); err != nil {
		t.Fatal("restore remained busy:", err)
	}
}

func TestSlowMarkdownReadsAllowOtherRequests(t *testing.T) {
	for _, operation := range []string{"GetDocument", "ListComments", "CreateComment"} {
		t.Run(operation, func(t *testing.T) {
			s, _ := snapshotSession(t, 2)
			entered, release := make(chan struct{}), make(chan struct{})
			var once sync.Once
			unblock := func() { once.Do(func() { close(release) }) }
			t.Cleanup(unblock)
			s.ReadRemote = func(ctx context.Context, source string) (string, error) {
				if filepath.Base(source) == "1.md" {
					close(entered)
					<-release
				}
				return "# Title\n", nil
			}
			first := make(chan error, 1)
			go func() {
				if operation == "GetDocument" {
					result, err := s.GetDocument(context.Background(), 1)
					if err == nil && (result.DisplayTitle == nil || *result.DisplayTitle != "Updated while reading") {
						err = fmt.Errorf("read returned an outdated title: %v", result.DisplayTitle)
					}
					first <- err
					return
				}
				_, err := s.Invoke(context.Background(), operation, Input{DocumentID: 1, StartLine: 1, EndLine: 1, Body: "Review"})
				first <- err
			}()
			select {
			case <-entered:
			case <-time.After(5 * time.Second):
				t.Fatal("Markdown read did not start")
			}
			second := make(chan error, 1)
			go func() { _, err := s.GetDocument(context.Background(), 2); second <- err }()
			select {
			case err := <-second:
				if err != nil {
					t.Fatal(err)
				}
			case <-time.After(time.Second):
				unblock()
				_ = <-first
				t.Fatal("slow Markdown read blocked another document")
			}
			if _, err := s.UpdateDocumentTitle(context.Background(), 1, "Updated while reading"); err != nil {
				t.Fatal(err)
			}
			unblock()
			if err := <-first; err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestCreateCommentRebasesExistingAnchors(t *testing.T) {
	file := filepath.Join(t.TempDir(), "review.md")
	if err := os.WriteFile(file, []byte("Heading\nOld body\n"), 0600); err != nil {
		t.Fatal(err)
	}
	s, err := New(t.Context(), file, directoryRepository(t), config.Defaults())
	if err != nil {
		t.Fatal(err)
	}
	input := Input{DocumentID: ID(s.Documents[0].ID), StartLine: 2, EndLine: 2, Body: "First"}
	if _, err := s.Invoke(t.Context(), "CreateComment", input); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(file, []byte("Heading\nInserted\nOld body\n"), 0600); err != nil {
		t.Fatal(err)
	}
	input.Body = "Second"
	if _, err := s.Invoke(t.Context(), "CreateComment", input); err != nil {
		t.Fatal(err)
	}
	result, err := s.Invoke(t.Context(), "ListComments", input)
	if err != nil {
		t.Fatal(err)
	}
	comments := result.(u.Comments).Comments
	if len(comments) != 2 || comments[0].StartLine != 3 || comments[0].OriginalStartLine != 2 ||
		comments[0].CurrentSourceText == nil || *comments[0].CurrentSourceText != "Old body" ||
		comments[1].StartLine != 2 {
		t.Fatalf("unexpected anchors after adding the second comment: %+v", comments)
	}
}
