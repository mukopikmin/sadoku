package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDocumentAttributesCLI(t *testing.T) {
	root := t.TempDir()
	t.Setenv("SADOKU_COMMENTS_DIR", filepath.Join(root, "comments"))
	run := func(args ...string) map[string]any {
		t.Helper()
		var out bytes.Buffer
		if err := Execute(context.Background(), args, &out, nil); err != nil {
			t.Fatal(args, err)
		}
		var result map[string]any
		if err := json.Unmarshal(out.Bytes(), &result); err != nil {
			t.Fatal(out.String(), err)
		}
		return result
	}
	assertState := func(doc map[string]any, title string, ids ...int) {
		t.Helper()
		if title == "" {
			if _, ok := doc["displayTitle"]; ok {
				t.Fatal("title was not cleared", doc)
			}
		} else if doc["displayTitle"] != title {
			t.Fatal("wrong title", doc)
		}
		tags, ok := doc["tags"].([]any)
		if !ok || len(tags) != len(ids) {
			t.Fatal("wrong tags", doc)
		}
		found := map[int]bool{}
		for _, tag := range tags {
			found[int(tag.(map[string]any)["id"].(float64))] = true
		}
		for _, id := range ids {
			if !found[id] {
				t.Fatal("missing tag", id, doc)
			}
		}
	}
	run("tag", "add", "--name", "One")
	run("tag", "add", "--name", "Two")
	source := filepath.Join(root, "doc.md")
	if err := os.WriteFile(source, []byte("# Original\n"), 0600); err != nil {
		t.Fatal(err)
	}
	assertState(run("document", "add", source, "--title", "Initial", "--tags", "1,2"), "Initial", 1, 2)
	assertState(run("document", "update", "1", "--title", "  Revised  "), "Revised", 1, 2)
	assertState(run("document", "update", "1", "--tags", "2,2"), "Revised", 2)
	assertState(run("document", "update", "1", "--title", "Both", "--tags", "1"), "Both", 1)
	for _, args := range [][]string{
		{"document", "update", "1", "--title", "Must not persist", "--tags", "1,99"},
		{"document", "add", source, "--title", "Must not persist", "--tags", "2"},
		{"document", "add", source},
		{"document", "add", source, "--create", "--title", "Must not persist"},
		{"document", "update", "99", "--title", "Missing"},
		{"document", "add", filepath.Join(root, "missing.md"), "--tags", "99"},
		{"document", "add", filepath.Join(root, "not-created.md"), "--create", "--tags", "99"},
	} {
		if err := Execute(context.Background(), args, &bytes.Buffer{}, nil); err == nil {
			t.Fatal("accepted", args)
		}
		assertState(run("document", "inspect", "1"), "Both", 1)
	}
	if _, err := os.Stat(filepath.Join(root, "not-created.md")); !os.IsNotExist(err) {
		t.Fatal("invalid tags created a file", err)
	}
	var list bytes.Buffer
	if err := Execute(context.Background(), []string{"document", "list"}, &list, nil); err != nil {
		t.Fatal(err)
	}
	var documents []any
	if err := json.Unmarshal(list.Bytes(), &documents); err != nil || len(documents) != 1 {
		t.Fatal("failed add registered a document", list.String(), err)
	}
	assertState(run("document", "update", "1", "--title", ""), "", 1)
	assertState(run("document", "update", "1", "--tags", ""), "")
	assertState(run("document", "update", "1", "--title=Restored", "--tags=1,2"), "Restored", 1, 2)
	assertState(run("document", "update", "1", "--title=", "--tags="), "")
	assertState(run("document", "add", filepath.Join(root, "created"), "--create", "--title", "Created", "--tags", "2"), "Created", 2)
	if data, err := os.ReadFile(source); err != nil || string(data) != "# Original\n" {
		t.Fatal("source changed", string(data), err)
	}
}

func TestDocumentAttributeValidationBeforeWriting(t *testing.T) {
	root := t.TempDir()
	comments := filepath.Join(root, "comments")
	t.Setenv("SADOKU_COMMENTS_DIR", comments)
	cases := [][]string{
		{"document", "update", "1"},
		{"document", "update", "1", "--title"},
		{"document", "update", "1", "--tags"},
		{"document", "update", "0", "--title", "X"},
		{"document", "update", "9007199254740992", "--title", "X"},
		{"document", "update", "1", "--create", "--title", "X"},
		{"document", "update", "1", "--title", "bad\ntitle"},
		{"document", "inspect", "1", "--tags", "2"},
		{"tag", "add", "--name", "Tag", "--tags", "1"},
		{"document", "tag", "add", "1", "--document", "1"},
		{"document", "tag", "delete", "1", "--document", "1"},
	}
	for _, tags := range []string{"0", "1,", ",1", "1,,2", "bad", "1.5", "-1", "9007199254740992", " "} {
		cases = append(cases, []string{"document", "add", "x.md", "--tags=" + tags})
	}
	ids := []string{}
	for id := 1; id <= 21; id++ {
		ids = append(ids, fmt.Sprint(id))
	}
	cases = append(cases, []string{"document", "update", "1", "--tags", strings.Join(ids, ",")})
	for _, args := range cases {
		if err := Execute(context.Background(), args, &bytes.Buffer{}, nil); err == nil {
			t.Fatal("accepted", args)
		}
	}
	if _, err := os.Stat(comments); !os.IsNotExist(err) {
		t.Fatal("invalid command wrote a database", err)
	}
}
