package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSettingsPreserveExistingConfiguration(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("SADOKU_COMMENTS_DIR", "")
	t.Setenv("MDVIEW_COMMENTS_DIR", "")
	if err := AtomicWrite(Path(), []byte("commentsDirectory = '/old/comments'\ncustom = 'keep'\nshow_html_comments = false\n"), 0600); err != nil {
		t.Fatal(err)
	}
	s, _, err := Read()
	if err != nil || s.ShowHTMLComments || s.MaxDepth != 2 {
		t.Fatalf("read %+v %v", s, err)
	}
	s.Theme = "dark"
	s.CodeWrap = "wrap"
	s.ExcludedDirectories = []string{}
	if err = Save(s); err != nil {
		t.Fatal(err)
	}
	s, extra, err := Read()
	if err != nil || extra["custom"] != "keep" || extra["commentsDirectory"] != "/old/comments" || s.ShowHTMLComments || len(s.ExcludedDirectories) != 0 {
		t.Fatalf("save %+v %+v %v", s, extra, err)
	}
	directory, err := CommentsDirectory()
	if err != nil || directory != "/old/comments" {
		t.Fatal(directory, err)
	}
	t.Setenv("SADOKU_COMMENTS_DIR", "/override")
	directory, err = CommentsDirectory()
	if err != nil || directory != "/override" {
		t.Fatal(directory, err)
	}
}
func TestAtomicWriteDoesNotTruncateOnFailure(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "existing")
	if err := os.Mkdir(path, 0700); err != nil {
		t.Fatal(err)
	}
	child := filepath.Join(path, "keep")
	if err := os.WriteFile(child, []byte("old"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := AtomicWrite(path, []byte("replacement"), 0600); err == nil {
		t.Fatal("replaced directory")
	}
	b, err := os.ReadFile(child)
	if err != nil || string(b) != "old" {
		t.Fatal("lost contents", err)
	}
	entries, err := os.ReadDir(root)
	if err != nil || len(entries) != 1 {
		t.Fatal("temporary file was not cleaned up", err)
	}
}

func TestSavePreservesMalformedConfiguration(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	contents := []byte("theme_mode = [broken")
	if err := AtomicWrite(Path(), contents, 0600); err != nil {
		t.Fatal(err)
	}
	settings := Defaults()
	settings.Theme = "dark"
	settings.CodeWrap = "wrap"
	if err := Save(settings); err == nil {
		t.Fatal("overwrote malformed configuration")
	}
	actual, err := os.ReadFile(Path())
	if err != nil || string(actual) != string(contents) {
		t.Fatal("original configuration changed", err)
	}
}
