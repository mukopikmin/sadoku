package session

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"

	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	"github.com/mukopikmin/sadoku/src/server/storage"
)

func directoryRepository(t *testing.T) *storage.Repository {
	t.Helper()
	path := filepath.Join(t.TempDir(), "db.sqlite3")
	database, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { database.Close() })
	return &storage.Repository{DB: database, Path: path}
}

func TestLegacyDirectoryOrderAndRegistration(t *testing.T) {
	type document struct {
		ID   int64
		Path string
	}
	var fixture struct {
		Reference            string
		Files, Registration  []string
		Initial, AfterCreate []document
	}
	data, err := os.ReadFile("testdata/legacy_directory.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	if fixture.Reference != "368b47eb1ae18a84d428ce4367d25cb815584968" {
		t.Fatal("unknown directory reference")
	}
	root := t.TempDir()
	for _, name := range fixture.Files {
		p := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(p), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte("# Document"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	repo := directoryRepository(t)
	settings := config.Defaults()
	settings.MaxFiles = 100
	s, err := New(context.Background(), root, repo, settings)
	if err != nil {
		t.Fatal(err)
	}
	s.Prepare(context.Background(), settings)
	check := func(want []document) {
		t.Helper()
		got := []document{}
		for _, d := range s.Documents {
			got = append(got, document{d.ID, d.RelativePath})
		}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("directory order/IDs: %+v; want %+v", got, want)
		}
	}
	check(fixture.Initial)
	stored, err := repo.Documents()
	if err != nil {
		t.Fatal(err)
	}
	registered := []string{}
	for _, d := range stored {
		rel, _ := filepath.Rel(root, d.FilePath)
		registered = append(registered, filepath.ToSlash(rel))
	}
	if !reflect.DeepEqual(registered, fixture.Registration) {
		t.Fatalf("registered: %v; want %v", registered, fixture.Registration)
	}
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("APPDATA", "")
	if _, err = s.Invoke(context.Background(), "CreateDocument", Input{Filename: "Added"}); err != nil {
		t.Fatal(err)
	}
	check(fixture.AfterCreate)
}

func TestDirectoryLimitUsesFilesystemEnumeration(t *testing.T) {
	root := t.TempDir()
	for _, name := range []string{"z.md", "middle.md", "a.md", "last.md", "B.md"} {
		if err := os.WriteFile(filepath.Join(root, name), []byte("# Title"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	directory, err := os.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	entries, err := directory.ReadDir(-1)
	directory.Close()
	if err != nil {
		t.Fatal(err)
	}
	expected := []string{entries[0].Name(), entries[1].Name()}
	sort.Strings(expected)
	settings := config.Defaults()
	settings.MaxFiles = 2
	s, err := New(context.Background(), root, directoryRepository(t), settings)
	if err != nil {
		t.Fatal(err)
	}
	s.Prepare(context.Background(), settings)
	got := []string{}
	for _, d := range s.Documents {
		got = append(got, d.RelativePath)
	}
	sort.Strings(got)
	if !reflect.DeepEqual(got, expected) {
		names := []string{}
		for _, entry := range entries {
			names = append(names, entry.Name())
		}
		t.Fatalf("selected %v; want first native entries %v (enumeration %s)", got, expected, strings.Join(names, ","))
	}
}
