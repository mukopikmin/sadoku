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

	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	"github.com/mukopikmin/sadoku/src/server/storage"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

type failedRegistration struct {
	u.Repository
	stage string
}

func (r failedRegistration) Ensure(path string) (u.Document, error) {
	if r.stage == "ensure" {
		return u.Document{}, errors.New("registration failed")
	}
	return r.Repository.Ensure(path)
}
func (r failedRegistration) SetTitle(id int64, title *string) error {
	if r.stage == "title" {
		return errors.New("title failed")
	}
	return r.Repository.SetTitle(id, title)
}
func (r failedRegistration) InitializeSnapshot(id int64, markdown string) error {
	if r.stage == "snapshot" {
		return errors.New("snapshot failed")
	}
	return r.Repository.InitializeSnapshot(id, markdown)
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
			defer database.Close()
			s, err := New(context.Background(), root, &storage.Repository{DB: database}, config.Defaults())
			if err != nil {
				t.Fatal(err)
			}
			s.Prepare(context.Background(), config.Defaults())
			s.Repository = failedRegistration{s.Repository, stage}
			_, err = s.Invoke(context.Background(), "CreateDocument", Input{Filename: "saved", Title: "Title"})
			var failure *u.Failure
			if !errors.As(err, &failure) || failure.Kind != "internal" || failure.Message != "The file was created, but could not be added to the preview. Reopen this directory to load it." {
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

func (r blockedRevision) Revision(documentID, revisionID int64) (u.Revision, error) {
	close(r.entered)
	<-r.release
	return r.Repository.Revision(documentID, revisionID)
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
	revisions, err := repo.Revisions(s.Documents[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	entered, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	t.Cleanup(unblock)
	s.Repository = blockedRevision{repo, entered, release}
	expected := "Current"
	in := Input{DocumentID: ID(s.Documents[0].ID), RevisionID: ID(revisions[0].ID), ExpectedMarkdown: &expected}
	done := make(chan error, 1)
	go func() { _, err := s.Invoke(context.Background(), "RestoreDocumentRevision", in); done <- err }()
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("restore did not start")
	}
	second := make(chan error, 1)
	go func() { _, err := s.Invoke(context.Background(), "RestoreDocumentRevision", in); second <- err }()
	select {
	case err := <-second:
		var failure *u.Failure
		if !errors.As(err, &failure) || failure.Kind != "aborted" || failure.Message != "A restore is already in progress." {
			t.Fatalf("second restore: %v", err)
		}
	case <-time.After(time.Second):
		unblock()
		<-done
		t.Fatal("second restore waited instead of reporting busy")
	}
	unblock()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	s.Repository = repo
	if _, err := s.Invoke(context.Background(), "RestoreDocumentRevision", in); err != nil {
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
				result, err := s.Invoke(context.Background(), operation, Input{DocumentID: 1, StartLine: 1, EndLine: 1, Body: "Review"})
				if err == nil && operation == "GetDocument" && result.(map[string]any)["displayTitle"] != "Updated while reading" {
					err = fmt.Errorf("read returned an outdated title: %v", result)
				}
				first <- err
			}()
			select {
			case <-entered:
			case <-time.After(5 * time.Second):
				t.Fatal("Markdown read did not start")
			}
			second := make(chan error, 1)
			go func() { _, err := s.Invoke(context.Background(), "GetDocument", Input{DocumentID: 2}); second <- err }()
			select {
			case err := <-second:
				if err != nil {
					t.Fatal(err)
				}
			case <-time.After(time.Second):
				unblock()
				<-first
				t.Fatal("slow Markdown read blocked another document")
			}
			if _, err := s.Invoke(context.Background(), "UpdateDocumentTitle", Input{DocumentID: 1, Title: "Updated while reading"}); err != nil {
				t.Fatal(err)
			}
			unblock()
			if err := <-first; err != nil {
				t.Fatal(err)
			}
		})
	}
}
