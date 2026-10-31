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

func TestInstructionValueCLI(t *testing.T) {
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
	source := filepath.Join(root, "doc.md")
	run("document", "add", source, "--create")
	for _, scope := range [][]string{{"--global"}, {"--document", "1"}, {"--source", source}} {
		invoke := func(operation string, content ...string) map[string]any {
			args := append([]string{"instruction", operation}, scope...)
			if len(content) > 0 {
				args = append(args, "--content", content[0])
			}
			return run(args...)
		}
		if invoke("get")["content"] != "" {
			t.Fatal("unexpected existing content")
		}
		if got := invoke("set", "First\r\nparagraph\n"); got["content"] != "First\nparagraph" || len(got) != 1 {
			t.Fatal(got)
		}
		invoke("set", "Replacement")
		if got := invoke("get"); got["content"] != "Replacement" {
			t.Fatal(got)
		}
		if got := invoke("set", " \n "); got["content"] != "" {
			t.Fatal(got)
		}
		if got := invoke("get"); got["content"] != "" {
			t.Fatal(got)
		}
		invoke("set", "Clear me")
		invoke("clear")
		invoke("clear")
		if got := invoke("get"); got["content"] != "" {
			t.Fatal(got)
		}
	}
	run("instruction", "set", "--global", "--content", "Global")
	run("instruction", "set", "--source", source, "--content", "Local")
	if run("instruction", "get", "--global")["content"] != "Global" {
		t.Fatal("local instruction changed global guidance")
	}
}

func TestInstructionValueRejectsInvalidOptions(t *testing.T) {
	for _, args := range [][]string{
		{"instruction", "get", "--global", "--content", "x"},
		{"instruction", "set", "--global"},
		{"instruction", "clear", "--global", "--content", "x"},
		{"instruction", "set", "1", "--global", "--content", "x"},
		{"instruction", "get", "--global", "--document", "1"},
		{"memory", "set", "--document", "1", "--content", "x"},
	} {
		opts, err := Parse(args)
		if err == nil {
			err = validate(opts)
		}
		if err == nil {
			t.Fatalf("accepted %v", args)
		}
	}
}
