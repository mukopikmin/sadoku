package session

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

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
