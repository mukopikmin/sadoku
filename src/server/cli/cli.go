package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	"github.com/mukopikmin/sadoku/src/server/session"
	"github.com/mukopikmin/sadoku/src/server/storage"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

var Version = "0.0.0-dev"

const Usage = `Usage:
  sadoku start <file.md|directory|url> [--port 3334] [--host 127.0.0.1] [--no-open] [--keep-alive]
  sadoku document add <source> [--create] [--title <title>]
  sadoku document list
  sadoku document inspect <id>
  sadoku document tag add|delete <tag-id>... (--document <id> | --source <source>)
  sadoku tag add --name <name>
  sadoku tag list
  sadoku tag delete <id>
  sadoku instruction|memory list|add|update|delete [id] (--document <id> | --source <source>) [--content <text>]
  sadoku comment list|add|update|delete|resolve|reopen [id]... (--document <id> | --source <source>)
  sadoku comment reply add|update|delete [id] (--document <id> | --source <source>) --comment <id> [--body <text>]
  sadoku update [--channel stable|nightly]

Comment options: --start-line <line>, --end-line <line>, --body <text>, --as-bot,
  --ensure-document (add only), --request-review (bot replies only).
Preview options: --max-depth <depth>, --max-files <count>, --trust-forwarded-prefix.
  -h, --help       Show help.
  -v, --version    Show version.
`

type Options struct {
	Words  []string
	Values map[string]string
	Flags  map[string]bool
}

var booleanOptions = map[string]bool{"help": true, "version": true, "no-open": true, "keep-alive": true, "create": true, "as-bot": true, "ensure-document": true, "request-review": true, "trust-forwarded-prefix": true}
var valueOptions = map[string]bool{"port": true, "host": true, "max-depth": true, "max-files": true, "source": true, "document": true, "title": true, "name": true, "body": true, "content": true, "comment": true, "start-line": true, "end-line": true, "channel": true}

func Parse(args []string) (Options, error) {
	o := Options{Values: map[string]string{}, Flags: map[string]bool{}}
	for i := 0; i < len(args); i++ {
		a := args[i]
		if a == "--" {
			o.Words = append(o.Words, args[i+1:]...)
			break
		}
		if !strings.HasPrefix(a, "-") {
			o.Words = append(o.Words, a)
			continue
		}
		switch a {
		case "-h":
			a = "--help"
		case "-v":
			a = "--version"
		case "-p":
			a = "--port"
		}
		name, value, hasValue := strings.Cut(strings.TrimPrefix(a, "--"), "=")
		if booleanOptions[name] {
			if hasValue && value != "true" && value != "false" {
				return o, fmt.Errorf("invalid boolean: %s", a)
			}
			o.Flags[name] = !hasValue || value == "true"
			continue
		}
		if !valueOptions[name] {
			return o, fmt.Errorf("unknown option: %s", a)
		}
		if !hasValue {
			i++
			if i >= len(args) {
				return o, fmt.Errorf("missing value for --%s", name)
			}
			value = args[i]
		}
		o.Values[name] = value
	}
	return o, nil
}
func number(value, name string, min int64) (int64, error) {
	n, err := strconv.ParseInt(value, 10, 64)
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
	if o.Flags["help"] {
		_, err = fmt.Fprint(out, Usage)
		return err
	}
	if o.Flags["version"] {
		_, err = fmt.Fprintln(out, "sadoku "+Version)
		return err
	}
	if len(o.Words) == 0 {
		return fmt.Errorf("missing command; run sadoku --help")
	}
	if err := validate(o); err != nil {
		return err
	}
	words := o.Words
	command := words[0]
	if command == "start" {
		if len(words) != 2 {
			return fmt.Errorf("start requires one Markdown file, directory, or URL")
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
		for key := range o.Values {
			if key != "host" && key != "port" && key != "max-depth" && key != "max-files" {
				return fmt.Errorf("--%s is not a preview option", key)
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
	for _, key := range []string{"host", "port", "max-depth", "max-files"} {
		if _, ok := o.Values[key]; ok {
			return fmt.Errorf("--%s is a preview option", key)
		}
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
	printJSON := func(value any) error { enc := json.NewEncoder(out); enc.SetIndent("", "  "); return enc.Encode(value) }
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
			return printJSON(docs)
		case "add":
			if len(words) != 3 {
				return fmt.Errorf("document add requires one source")
			}
			identity, source, remote := session.Source(words[2])
			var doc u.Document
			if o.Flags["create"] {
				if remote {
					return fmt.Errorf("--create requires a local Markdown filename")
				}
				s := &session.Session{Root: filepath.Dir(source), CanCreate: true, Repository: repo, Sources: map[int64]string{}}
				result, e := s.Invoke(ctx, "CreateDocument", session.Input{Filename: filepath.Base(source), Title: o.Values["title"]})
				if e != nil {
					return e
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
					title = strings.TrimSpace(title)
					doc.DisplayTitle = nil
					if title != "" {
						doc.DisplayTitle = &title
					}
					if err = repo.SetTitle(doc.ID, doc.DisplayTitle); err != nil {
						return err
					}
				}
			}
			result := map[string]any{"id": doc.ID, "filePath": doc.FilePath}
			if doc.DisplayTitle != nil {
				result["displayTitle"] = *doc.DisplayTitle
			}
			return printJSON(result)
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
					return printJSON(doc)
				}
			}
			return fmt.Errorf("document not found")
		}
		return fmt.Errorf("invalid document command")
	}
	if len(words) < 2 {
		return fmt.Errorf("missing operation")
	}
	operation := words[1]
	if command == "tag" {
		s := &session.Session{Repository: repo}
		in := session.Input{Name: o.Values["name"]}
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
			return err
		}
		if operation == "list" {
			result = result.(map[string]any)["tags"]
		}
		return printJSON(result)
	}
	if command != "comment" && command != "instruction" && command != "memory" && !(command == "document" && operation == "tag") {
		return fmt.Errorf("invalid command: %s", command)
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
		return fmt.Errorf("document is not registered; run sadoku document add first")
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
		for _, word := range words[3:] {
			id, e := number(word, "tag ID", 1)
			if e != nil {
				return e
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
		switch operation {
		case "list":
			op = "ListComments"
		case "add":
			op = "CreateComment"
			n, e := number(o.Values["start-line"], "start line", 1)
			if e != nil {
				return e
			}
			in.StartLine = int(n)
			in.EndLine = in.StartLine
			if end, ok := o.Values["end-line"]; ok {
				n, e = number(end, "end line", 1)
				if e != nil {
					return e
				}
				in.EndLine = int(n)
			}
		case "update", "delete":
			if len(words) != 3 {
				return fmt.Errorf("operation requires a comment ID")
			}
			n, e := number(words[2], "comment ID", 1)
			if e != nil {
				return e
			}
			in.CommentID = session.ID(n)
			op = strings.ToUpper(operation[:1]) + operation[1:] + "Comment"
		case "resolve", "reopen":
			if len(words) < 3 {
				return fmt.Errorf("operation requires comment IDs")
			}
			comments, err := repo.ReadComments(selected.ID)
			if err != nil {
				return err
			}
			wanted := map[int64]bool{}
			for _, word := range words[2:] {
				n, e := number(word, "comment ID", 1)
				if e != nil {
					return e
				}
				wanted[n] = true
			}
			for _, c := range comments.Comments {
				delete(wanted, c.ID)
			}
			if len(wanted) > 0 {
				return fmt.Errorf("comment not found")
			}
			now := db.Now()
			requested := map[int64]bool{}
			for _, word := range words[2:] {
				n, _ := number(word, "comment ID", 1)
				requested[n] = true
				var result any
				comments, result, err = u.ChangeComment("SetCommentResolution", comments, u.CommentInput{CommentID: n, Resolved: operation == "resolve", AsBot: in.AsBot}, "", now)
				_ = result
				if err != nil {
					return err
				}
			}
			if err = repo.SaveComments(selected.ID, comments); err != nil {
				return err
			}
			filtered := []u.Comment{}
			for _, c := range comments.Comments {
				if requested[c.ID] {
					filtered = append(filtered, c)
				}
			}
			comments.Comments = filtered
			return printJSON(comments)

		case "reply":
			if len(words) < 3 {
				return fmt.Errorf("missing reply operation")
			}
			n, e := number(o.Values["comment"], "comment ID", 1)
			if e != nil {
				return e
			}
			in.CommentID = session.ID(n)
			switch words[2] {
			case "add":
				op = "CreateReply"
			case "update", "delete":
				if len(words) != 4 {
					return fmt.Errorf("reply operation requires an ID")
				}
				n, e = number(words[3], "reply ID", 1)
				if e != nil {
					return e
				}
				in.ReplyID = session.ID(n)
				op = strings.ToUpper(words[2][:1]) + words[2][1:] + "Reply"
			default:
				return fmt.Errorf("invalid reply operation")
			}
		default:
			return fmt.Errorf("invalid comment operation")
		}
	}
	result, err := s.Invoke(ctx, op, in)
	if err != nil {
		return err
	}
	if op == "ListInstructions" || op == "ListMemories" {
		result.(map[string]any)["document"] = selected
	}
	if op == "ReplaceDocumentTags" {
		result = result.(map[string]any)["tags"]
	}
	return printJSON(result)
}
