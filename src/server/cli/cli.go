package cli

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	"github.com/mukopikmin/sadoku/src/server/session"
	"github.com/mukopikmin/sadoku/src/server/storage"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

var Version = "0.0.0-dev"

const Usage = `Usage:
  sadoku start <file.md|directory|url> [--port <port>] [--host <host>] [--max-depth <depth>] [--max-files <count>] [--no-open] [--keep-alive] [--trust-forwarded-prefix]
  sadoku document add <file.md|url> [--create] [--title <text>]
  sadoku document inspect <document-id>
  sadoku document list
  sadoku document tag add <tag-id>... (--document <id> | --source <file.md|url>)
  sadoku document tag delete <tag-id>... (--document <id> | --source <file.md|url>)
  sadoku tag add --name <name>
  sadoku tag delete <tag-id>
  sadoku tag list
  sadoku instruction get (--global | --document <id> | --source <file.md|url>)
  sadoku instruction set (--global | --document <id> | --source <file.md|url>) --content <text>
  sadoku instruction clear (--global | --document <id> | --source <file.md|url>)
  sadoku instruction list (--global | --document <id> | --source <file.md|url>)
  sadoku instruction add (--global | --document <id> | --source <file.md|url>) --content <text>
  sadoku instruction update <instruction-id> (--global | --document <id> | --source <file.md|url>) --content <text>
  sadoku instruction delete <instruction-id> (--global | --document <id> | --source <file.md|url>)
  sadoku memory list (--document <id> | --source <file.md|url>)
  sadoku memory add (--document <id> | --source <file.md|url>) --content <text>
  sadoku memory update <memory-id> (--document <id> | --source <file.md|url>) --content <text>
  sadoku memory delete <memory-id> (--document <id> | --source <file.md|url>)
  sadoku comment list (--document <id> | --source <file.md|url>)
  sadoku comment add (--document <id> | --source <file.md|url> [--ensure-document]) --start-line <line> [--end-line <line>] --body <text> [--as-bot]
  sadoku comment update <comment-id> (--document <id> | --source <file.md|url>) --body <text>
  sadoku comment delete <comment-id> (--document <id> | --source <file.md|url>)
  sadoku comment resolve <comment-id>... (--document <id> | --source <file.md|url>) [--as-bot]
  sadoku comment reopen <comment-id>... (--document <id> | --source <file.md|url>)
  sadoku comment reply add (--document <id> | --source <file.md|url>) --comment <id> --body <text> [--as-bot] [--request-review]
  sadoku comment reply update <reply-id> (--document <id> | --source <file.md|url>) --comment <id> --body <text>
  sadoku comment reply delete <reply-id> (--document <id> | --source <file.md|url>) --comment <id>
  sadoku update [--channel stable|nightly]

Options:
  --create          Create a new local Markdown file and register it (document add only).
  --title           Display title (document add only).
  --name            Tag name (tag add only).
  --global          Apply to all documents in this database (instruction commands only).
  --document        Existing document ID.
  --source          Existing Markdown file or URL.
  --ensure-document Register --source when it is not in the database (comment add only).
  --comment         Parent comment ID for reply operations.
  --start-line      First commented line.
  --end-line        Last commented line. Defaults to --start-line.
  --body            Comment or reply body.
  --content         Instruction or memory content.
  --as-bot          Attribute supported comment actions to a bot.
  --request-review  Request review in a bot reply (requires --as-bot).
  -p, --port        Starting preview port. Defaults to 3334.
  --host            Preview host. Defaults to 127.0.0.1.
  --no-open         Do not open the preview automatically.
  --keep-alive      Keep the server running after the browser tab closes.
  --trust-forwarded-prefix Accept X-Forwarded-Prefix from a trusted reverse proxy.
  --max-depth       Maximum directory depth to scan. Defaults to 2 (0 scans only the root).
  --max-files       Maximum number of Markdown files to load. Defaults to 20.
  --channel         Update channel.
  -v, --version     Show version.
  -h, --help        Show this help message.
`

type Options struct {
	Words  []string
	Values map[string]string
	Flags  map[string]bool
}

var booleanOptions = map[string]bool{"global": true, "help": true, "version": true, "no-open": true, "keep-alive": true, "create": true, "as-bot": true, "ensure-document": true, "request-review": true, "trust-forwarded-prefix": true}
var valueOptions = map[string]bool{"port": true, "host": true, "max-depth": true, "max-files": true, "source": true, "document": true, "title": true, "name": true, "body": true, "content": true, "comment": true, "start-line": true, "end-line": true, "channel": true}

func Parse(args []string) (Options, error) {
	o := Options{Values: map[string]string{}, Flags: map[string]bool{}}
	// Expand short aliases, including clusters such as -hv and attached -p3334.
	expanded := []string{}
	for i, arg := range args {
		if arg == "--" {
			expanded = append(expanded, args[i:]...)
			break
		}
		if strings.HasPrefix(arg, "-") && !strings.HasPrefix(arg, "--") && len(arg) > 1 {
			for j := 1; j < len(arg); j++ {
				name := ""
				switch arg[j] {
				case 'h':
					name = "help"
				case 'v':
					name = "version"
				case 'p':
					name = "port"
				default:
					expanded = append(expanded, fmt.Sprintf("-%c", arg[j]))
					j = len(arg)
					continue
				}
				if name == "port" && j+1 < len(arg) {
					expanded = append(expanded, "--port="+strings.TrimPrefix(arg[j+1:], "="))
					break
				}
				expanded = append(expanded, "--"+name)
				if j+1 < len(arg) && arg[j+1] == '=' {
					break
				}
			}
		} else {
			expanded = append(expanded, arg)
		}
	}
	for i := 0; i < len(expanded); i++ {
		a := expanded[i]
		if a == "--" {
			o.Words = append(o.Words, expanded[i+1:]...)
			break
		}
		if !strings.HasPrefix(a, "-") {
			o.Words = append(o.Words, a)
			continue
		}
		name, value, hasValue := strings.Cut(strings.TrimPrefix(a, "--"), "=")
		if booleanOptions[name] {
			if name == "no-open" && hasValue {
				return o, usageError("Unknown option: %s", a)
			}
			if !hasValue && i+1 < len(expanded) && (expanded[i+1] == "true" || expanded[i+1] == "false") {
				i++
				value = expanded[i]
			}
			o.Flags[name] = value != "false"
			continue
		}
		if !valueOptions[name] {
			return o, usageError("Unknown option: %s", a)
		}
		if !hasValue && i+1 < len(expanded) && expanded[i+1] != "" && !strings.HasPrefix(expanded[i+1], "-") {
			i++
			value = expanded[i]
		}
		o.Values[name] = value
	}
	return o, nil
}
func number(value, name string, min int64) (int64, error) {
	n, err := cliInteger(value)
	if err != nil || n < min || n > 9007199254740991 {
		return 0, fmt.Errorf("%s must be an integer >= %d", name, min)
	}
	return n, nil
}

type StartOptions struct {
	Source, Host                          string
	Port                                  int
	Open, KeepAlive, TrustForwardedPrefix bool
	MaxDepth, MaxFiles                    *int
}
type Start func(context.Context, StartOptions) error

func Execute(ctx context.Context, args []string, out io.Writer, start Start) error {
	o, err := Parse(args)
	if err != nil {
		return err
	}
	if err := validate(o); err != nil {
		return err
	}
	if o.Flags["help"] {
		_, err = io.WriteString(out, Usage+"\n")
		return err
	}
	if o.Flags["version"] {
		_, err = fmt.Fprintln(out, "sadoku "+Version)
		return err
	}
	if len(o.Words) == 0 {
		return usageError("Missing Markdown file or directory.")
	}
	words := o.Words
	command := words[0]
	if command == "start" {
		if len(words) != 2 {
			return usageError("Missing Markdown file or directory.")
		}
		options := StartOptions{Source: words[1], Host: "127.0.0.1", Port: 3334, Open: !o.Flags["no-open"], KeepAlive: o.Flags["keep-alive"], TrustForwardedPrefix: o.Flags["trust-forwarded-prefix"]}
		if v := o.Values["host"]; v != "" {
			options.Host = v
		}
		if v := o.Values["port"]; v != "" {
			n, e := number(v, "port", 1)
			if e != nil || n > 65535 {
				return fmt.Errorf("invalid port")
			}
			options.Port = int(n)
		}
		for _, key := range []string{"max-depth", "max-files"} {
			if v, ok := o.Values[key]; ok {
				minimum := int64(0)
				if key == "max-files" {
					minimum = 1
				}
				n, e := number(v, key, minimum)
				if e != nil {
					return e
				}
				value := int(n)
				if key == "max-depth" {
					options.MaxDepth = &value
				} else {
					options.MaxFiles = &value
				}
			}
		}
		return start(ctx, options)
	}
	if command == "update" {
		if len(words) != 1 {
			return fmt.Errorf("update accepts no positional arguments")
		}
		return Update(ctx, o.Values["channel"], out)
	}
	directory, err := config.CommentsDirectory()
	if err != nil {
		return err
	}
	path := filepath.Join(directory, "sadoku.sqlite3")
	database, err := db.Open(path)
	if err != nil {
		return err
	}
	defer database.Close()
	repo := &storage.Repository{DB: database, Path: path}
	printJSON := func(value any) error { return printJSON(out, value) }
	if command == "document" && len(words) >= 2 && words[1] != "tag" {
		switch words[1] {
		case "list":
			if len(words) != 2 {
				return fmt.Errorf("document list accepts no arguments")
			}
			docs, err := repo.Documents()
			if err != nil {
				return err
			}
			for i := range docs {
				docs[i].Tags, err = repo.Tags(docs[i].ID)
				if err != nil {
					return err
				}
			}
			result := []object{}
			for _, doc := range docs {
				result = append(result, documentOutput(doc, true))
			}
			return printJSON(result)
		case "add":
			if len(words) != 3 {
				return fmt.Errorf("document add requires one source")
			}
			identity, source, remote := session.Source(words[2])
			var doc u.Document
			if o.Flags["create"] {
				if remote || u.TrimSpace(words[2]) == "" || strings.HasSuffix(words[2], "/") || strings.HasSuffix(words[2], "\\") || filepath.Base(words[2]) == "." || filepath.Base(words[2]) == ".." {
					return fmt.Errorf("--create requires a local Markdown filename.")
				}
				s := &session.Session{Root: filepath.Dir(source), CanCreate: true, Repository: repo, Sources: map[int64]string{}}
				// Windows path normalization can remove a trailing dot before the
				// filename validator sees it. Validate the spelling the user supplied.
				result, e := s.Invoke(ctx, "CreateDocument", session.Input{Filename: filepath.Base(words[2]), Title: o.Values["title"]})
				if e != nil {
					return documentError(e)
				}
				doc = result.(u.Document)
			} else {
				doc, err = repo.Ensure(identity)
				if err != nil {
					return err
				}
				if title, ok := o.Values["title"]; ok {
					if strings.ContainsAny(title, "\r\n\x00") {
						return fmt.Errorf("title must be a single line")
					}
					title = u.TrimSpace(title)
					doc.DisplayTitle = nil
					if title != "" {
						doc.DisplayTitle = &title
					}
					if err = repo.SetTitle(doc.ID, doc.DisplayTitle); err != nil {
						return err
					}
				}
			}
			return printJSON(documentOutput(doc, false))
		case "inspect":
			if len(words) != 3 {
				return fmt.Errorf("document inspect requires one ID")
			}
			id, err := number(words[2], "document ID", 1)
			if err != nil {
				return err
			}
			docs, err := repo.Documents()
			if err != nil {
				return err
			}
			for _, doc := range docs {
				if doc.ID == id {
					doc.Tags, err = repo.Tags(id)
					if err != nil {
						return err
					}
					return printJSON(documentOutput(doc, true))
				}
			}
			return fmt.Errorf("Document not found: %d", id)
		}
		return fmt.Errorf("invalid document command")
	}
	if len(words) < 2 {
		return fmt.Errorf("missing operation")
	}
	operation := words[1]
	if command == "tag" {
		s := &session.Session{Repository: repo}
		in := session.Input{Name: u.TrimSpace(o.Values["name"])}
		if operation == "add" {
			if err := validateTagName(in.Name); err != nil {
				return err
			}
		}
		op := ""
		switch operation {
		case "list":
			op = "ListTags"
		case "add":
			op = "CreateTag"
		case "delete":
			if len(words) != 3 {
				return fmt.Errorf("tag delete requires an ID")
			}
			id, e := number(words[2], "tag ID", 1)
			if e != nil {
				return e
			}
			in.ID = session.ID(id)
			op = "DeleteTag"
		default:
			return fmt.Errorf("invalid tag operation")
		}
		result, err := s.Invoke(ctx, op, in)
		if err != nil {
			if err.Error() == "Tag not found." {
				return fmt.Errorf("Tag %d not found.", in.ID)
			}
			if err.Error() == "A tag with this name already exists." {
				return fmt.Errorf("Tag name already exists.")
			}
			return err
		}
		if operation == "delete" {
			_, err = fmt.Fprintf(out, "Deleted tag %d.\n", in.ID)
			return err
		}
		if operation == "list" {
			tags := []object{}
			for _, tag := range sortedTags(result.(map[string]any)["tags"].([]u.Tag)) {
				tags = append(tags, tagOutput(tag, true))
			}
			return printJSON(tags)
		}
		return printJSON(tagOutput(result.(u.Tag), false))
	}
	if command != "comment" && command != "instruction" && command != "memory" && !(command == "document" && operation == "tag") {
		return fmt.Errorf("invalid command: %s", command)
	}
	if command == "instruction" && o.Flags["global"] {
		if operation == "get" || operation == "set" || operation == "clear" {
			return executeInstructionValue(repo, 0, o, out)
		}
		return executeGlobalInstructions(ctx, &session.Session{Repository: repo}, o, out)
	}
	source, hasSource := o.Values["source"]
	document, hasDocument := o.Values["document"]
	if hasSource == hasDocument {
		return fmt.Errorf("specify exactly one of --document or --source")
	}
	docs, err := repo.Documents()
	if err != nil {
		return err
	}
	var selected *u.Document
	if hasDocument {
		id, e := number(document, "document ID", 1)
		if e != nil {
			return e
		}
		for i := range docs {
			if docs[i].ID == id {
				selected = &docs[i]
			}
		}
	} else {
		identity, _, _ := session.Source(source)
		for i := range docs {
			if docs[i].FilePath == identity {
				selected = &docs[i]
			}
		}
		if selected == nil && o.Flags["ensure-document"] && command == "comment" && operation == "add" {
			doc, e := repo.Ensure(identity)
			if e != nil {
				return e
			}
			selected = &doc
		}
	}
	if selected == nil {
		if hasDocument {
			id, _ := cliInteger(document)
			return fmt.Errorf("Document not found: %d", id)
		}
		identity, _, _ := session.Source(source)
		if command == "comment" {
			return fmt.Errorf("Document is not registered: %s. Pass --ensure-document to register it.", identity)
		}
		return fmt.Errorf("Document is not registered: %s. Run `sadoku document add %s` first.", identity, identity)
	}
	fetch := selected.FilePath
	if hasSource {
		_, fetch, _ = session.Source(source)
	}
	s := &session.Session{Root: filepath.Dir(selected.FilePath), Documents: []u.Document{*selected}, Sources: map[int64]string{selected.ID: fetch}, Repository: repo}
	in := session.Input{DocumentID: session.ID(selected.ID), Body: o.Values["body"], Content: o.Values["content"], AsBot: o.Flags["as-bot"], RequestReview: o.Flags["request-review"]}
	op := ""
	if command == "document" {
		if len(words) < 4 || (words[2] != "add" && words[2] != "delete") {
			return fmt.Errorf("document tag add/delete requires tag IDs")
		}
		tags, err := repo.Tags(selected.ID)
		if err != nil {
			return err
		}
		ids := map[int64]bool{}
		for _, tag := range tags {
			ids[tag.ID] = true
		}
		allTags, e := repo.Tags(0)
		if e != nil {
			return e
		}
		knownTags := map[int64]bool{}
		for _, tag := range allTags {
			knownTags[tag.ID] = true
		}
		for _, word := range words[3:] {
			id, e := number(word, "tag ID", 1)
			if e != nil {
				return e
			}
			if !knownTags[id] {
				return fmt.Errorf("Tag %d not found.", id)
			}
			if words[2] == "add" {
				ids[id] = true
			} else {
				delete(ids, id)
			}
		}
		for id := range ids {
			in.Tags = append(in.Tags, session.TagReference{ID: session.ID(id)})
		}
		op = "ReplaceDocumentTags"
	} else if command == "instruction" || command == "memory" {
		if command == "instruction" && (operation == "get" || operation == "set" || operation == "clear") {
			return executeInstructionValue(repo, selected.ID, o, out)
		}
		kind := "Instruction"
		if command == "memory" {
			kind = "Memory"
		}
		switch operation {
		case "list":
			op = "ListInstructions"
			if kind == "Memory" {
				op = "ListMemories"
			}
		case "add":
			op = "Create" + kind
		case "update", "delete":
			if len(words) != 3 {
				return fmt.Errorf("operation requires one ID")
			}
			id, e := number(words[2], "note ID", 1)
			if e != nil {
				return e
			}
			in.InstructionID = session.ID(id)
			in.MemoryID = session.ID(id)
			op = strings.ToUpper(operation[:1]) + operation[1:] + kind
		default:
			return fmt.Errorf("invalid note operation")
		}
	} else {
		return executeComments(ctx, s, o, out)
	}
	if (command == "instruction" || command == "memory") && (operation == "add" || operation == "update") {
		content := strings.ReplaceAll(strings.ReplaceAll(in.Content, "\r\n", "\n"), "\r", "\n")
		content = strings.TrimRight(content, "\n")
		if u.TrimSpace(content) == "" {
			return commandError(command, fmt.Errorf("Content must not be empty."))
		}
		n, err := repo.SaveNote(command, u.Note{ID: int64(in.InstructionID), DocumentID: selected.ID, Content: content})
		if err != nil {
			return commandError(command, err)
		}
		return printJSON(noteOutput(n))
	}
	result, err := s.Invoke(ctx, op, in)
	if err != nil {
		return commandError(command, err)
	}
	if op == "ListInstructions" || op == "ListMemories" {
		key := "instructions"
		if command == "memory" {
			key = "memories"
		}
		notes := []object{}
		for _, n := range result.(map[string]any)[key].([]u.Note) {
			notes = append(notes, noteOutput(n))
		}
		return printJSON(object{{"document", documentOutput(*selected, false)}, {key, notes}})
	}
	if op == "ReplaceDocumentTags" {
		tags := []object{}
		for _, tag := range sortedTags(result.(map[string]any)["tags"].([]u.Tag)) {
			tags = append(tags, object{{"id", tag.ID}, {"name", tag.Name}, {"backgroundColor", tag.BackgroundColor}})
		}
		return printJSON(tags)
	}
	if operation == "delete" {
		_, err = fmt.Fprintf(out, "Deleted %s %d.\n", command, in.InstructionID)
		return err
	}
	return printJSON(noteOutput(result.(u.Note)))
}
