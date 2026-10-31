package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGlobalInstructionRejectsAmbiguousScope(t *testing.T) {
	for _, args := range [][]string{
		{"instruction", "get", "--global", "--source", "a.md"},
		{"instruction", "set", "--global", "--document", "1", "--content", "x"},
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
		if got := invoke("set", ""); got["content"] != "" {
			t.Fatal(got)
		}
		if got := invoke("get"); got["content"] != "" {
			t.Fatal(got)
		}
		// Missing content and whitespace-only values must not erase saved guidance.
		invoke("set", "Keep this guidance")
		for _, words := range [][]string{
			{"instruction", "set"},
			{"instruction", "set", "--content"},
			{"instruction", "set", "--content", " "},
			{"instruction", "set", "--content", "\n"},
		} {
			args := append(words, scope...)
			var out bytes.Buffer
			if err := Execute(context.Background(), args, &out, nil); err == nil || out.Len() != 0 {
				t.Fatalf("invalid set accepted: %v", args)
			}
			if got := invoke("get"); got["content"] != "Keep this guidance" {
				t.Fatal(got)
			}
		}
		invoke("set", "Clear me")
		invoke("set", "")
		invoke("set", "")
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
		{"instruction", "set", "--global", "--content"},
		{"instruction", "set", "--content", "--global"},
		{"instruction", "clear", "--global"},
		{"instruction", "get", "1", "--global"},
		{"instruction", "set", "--global", "--content", " "},
		{"instruction", "set", "--global", "--content", "\n"},
		{"instruction", "set", "--global", "--content", "\r\n"},
		{"instruction", "set", "--global", "--content", "\t"},
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

func TestRetiredInstructionCommandsDoNotWrite(t *testing.T) {
	root := t.TempDir()
	comments := filepath.Join(root, "comments")
	t.Setenv("SADOKU_COMMENTS_DIR", comments)
	cases := []struct {
		words       []string
		replacement string
	}{
		{[]string{"list"}, "instruction get"},
		{[]string{"add", "--content", "Replacement"}, "instruction set --content <text>"},
		{[]string{"update", "1", "--content", "Replacement"}, "instruction set --content <text>"},
		{[]string{"delete", "1"}, "instruction set --content \"\""},
		{[]string{"clear"}, "instruction set --content \"\""},
	}
	reject := func(words, scope []string, replacement string) {
		t.Helper()
		args := append([]string{"instruction"}, words...)
		args = append(args, scope...)
		var out bytes.Buffer
		err := Execute(context.Background(), args, &out, nil)
		if err == nil || !strings.Contains(err.Error(), "Use "+replacement+" instead.") || out.Len() != 0 {
			t.Fatalf("retired command %v: output=%q error=%v", args, out.String(), err)
		}
	}
	// Rejected commands must fail before opening or migrating the database.
	for _, c := range cases {
		reject(c.words, []string{"--global"}, c.replacement)
	}
	if _, err := os.Stat(comments); !os.IsNotExist(err) {
		t.Fatalf("retired command created database directory: %v", err)
	}
	source := filepath.Join(root, "doc.md")
	if err := Execute(context.Background(), []string{"document", "add", source, "--create"}, &bytes.Buffer{}, nil); err != nil {
		t.Fatal(err)
	}
	for _, scope := range [][]string{{"--global"}, {"--document", "1"}, {"--source", source}} {
		args := append([]string{"instruction", "set", "--content", "Keep this guidance"}, scope...)
		if err := Execute(context.Background(), args, &bytes.Buffer{}, nil); err != nil {
			t.Fatal(err)
		}
		for _, c := range cases {
			reject(c.words, scope, c.replacement)
			var out bytes.Buffer
			args = append([]string{"instruction", "get"}, scope...)
			if err := Execute(context.Background(), args, &out, nil); err != nil {
				t.Fatal(err)
			}
			var got map[string]string
			if err := json.Unmarshal(out.Bytes(), &got); err != nil || got["content"] != "Keep this guidance" {
				t.Fatalf("retired command changed guidance: %s %v", out.String(), err)
			}
		}
	}
}
