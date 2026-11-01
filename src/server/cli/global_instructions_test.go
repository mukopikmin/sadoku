package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
)

func TestGlobalInstructionCLI(t *testing.T) {
	t.Setenv("SADOKU_COMMENTS_DIR", filepath.Join(t.TempDir(), "comments"))
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
	list := run("instruction", "list", "--global")
	if list["document"] != nil || len(list["instructions"].([]any)) != 0 {
		t.Fatal(list)
	}
	created := run("instruction", "add", "--global", "--content", "共通\r\n方針\n")
	if created["documentId"] != nil || created["content"] != "共通\n方針" {
		t.Fatal(created)
	}
	updated := run("instruction", "update", "1", "--global", "--content", "Updated")
	if updated["createdAt"] != created["createdAt"] || updated["content"] != "Updated" {
		t.Fatal(updated)
	}
	list = run("instruction", "list", "--global")
	if len(list["instructions"].([]any)) != 1 {
		t.Fatal(list)
	}
	var out bytes.Buffer
	if err := Execute(context.Background(), []string{"instruction", "delete", "1", "--global"}, &out, nil); err != nil {
		t.Fatal(err)
	}
	if len(run("instruction", "list", "--global")["instructions"].([]any)) != 0 {
		t.Fatal("not deleted")
	}
	if err := Execute(context.Background(), []string{"instruction", "update", "1", "--global", "--content", "missing"}, &out, nil); err == nil {
		t.Fatal("updated missing instruction")
	}
}

func TestGlobalInstructionRejectsAmbiguousScope(t *testing.T) {
	for _, args := range [][]string{
		{"instruction", "list", "--global", "--source", "a.md"},
		{"instruction", "add", "--global", "--document", "1", "--content", "x"},
		{"memory", "list", "--global"}, {"tag", "list", "--global"},
		{"start", "a.md", "--global"}, {"comment", "list", "--global", "--document", "1"},
	} {
		t.Run(args[0]+args[1], func(t *testing.T) {
			opts, err := Parse(args)
			if err == nil {
				err = validate(opts)
			}
			if err == nil {
				t.Fatalf("accepted %v", args)
			}
		})
	}
}
