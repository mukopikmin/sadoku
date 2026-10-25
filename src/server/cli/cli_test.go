package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestCLIWorkflow(t *testing.T) {
	directory := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(directory, "config"))
	t.Setenv("SADOKU_COMMENTS_DIR", filepath.Join(directory, "comments"))
	file := filepath.Join(directory, "readme.md")
	if err := os.WriteFile(file, []byte("# Title\nBody\n"), 0600); err != nil {
		t.Fatal(err)
	}
	run := func(args ...string) map[string]any {
		t.Helper()
		var out bytes.Buffer
		if err := Execute(context.Background(), args, &out, nil); err != nil {
			t.Fatal(args, err)
		}
		var value map[string]any
		if err := json.Unmarshal(out.Bytes(), &value); err != nil {
			t.Fatal(out.String(), err)
		}
		return value
	}
	doc := run("document", "add", file, "--title", "Custom")
	if doc["filePath"] != file || doc["displayTitle"] != "Custom" {
		t.Fatal(doc)
	}
	c := run("comment", "add", "--document", "1", "--start-line", "2", "--body", "review", "--as-bot")
	if c["author"].(map[string]any)["type"] != "bot" {
		t.Fatal(c)
	}
	c = run("comment", "reply", "add", "--source", file, "--comment", "1", "--body", "check", "--as-bot", "--request-review")
	if len(c["replies"].([]any)) != 1 {
		t.Fatal(c)
	}
	run("comment", "resolve", "1", "--source", file, "--as-bot")
	list := run("comment", "list", "--source", file)
	if !list["comments"].([]any)[0].(map[string]any)["resolved"].(bool) {
		t.Fatal(list)
	}
	run("instruction", "add", "--source", file, "--content", "Check grammar")
	notes := run("instruction", "list", "--source", file)
	if notes["document"] == nil || len(notes["instructions"].([]any)) != 1 {
		t.Fatal(notes)
	}
	run("memory", "add", "--source", file, "--content", "Context")
	notes = run("memory", "list", "--source", file)
	if len(notes["memories"].([]any)) != 1 {
		t.Fatal(notes)
	}
	run("document", "add", filepath.Join(directory, "new.md"), "--create")
	if _, err := os.Stat(filepath.Join(directory, "new.md")); err != nil {
		t.Fatal(err)
	}
}
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
