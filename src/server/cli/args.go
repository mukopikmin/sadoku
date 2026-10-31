package cli

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

// Validate in the original CLI's order so ambiguous mistakes retain their
// established diagnostic and help output.
func validate(o Options) error {
	word := func(i int) string {
		if i < len(o.Words) {
			return o.Words[i]
		}
		return ""
	}
	has := func(key string) bool { _, ok := o.Values[key]; return ok }
	positive := func(value, name string) (int64, error) {
		n, err := cliInteger(value)
		if err != nil || n < 1 {
			return 0, usageError("%s must be a positive integer.", name)
		}
		return n, nil
	}
	if o.Flags["global"] && word(0) != "instruction" {
		return usageError("--global is only accepted by instruction commands.")
	}
	if (o.Flags["create"] || has("title")) && !(word(0) == "document" && word(1) == "add") {
		return usageError("--create and --title are only accepted by document add.")
	}
	if strings.ContainsAny(o.Values["title"], "\r\n\x00") {
		return usageError("--title must be a single line without null characters.")
	}
	if has("max-depth") {
		n, err := cliInteger(o.Values["max-depth"])
		if err != nil || n < 0 {
			return usageError("--max-depth must be a non-negative integer.")
		}
	}
	if has("max-files") {
		if _, err := positive(o.Values["max-files"], "--max-files"); err != nil {
			return err
		}
	}
	port := int64(3334)
	if has("port") {
		n, err := positive(o.Values["port"], "Port")
		if err != nil {
			return err
		}
		port = n
	}
	if port > 65535 {
		return usageError("Invalid port: %d", port)
	}
	commentOptions := has("body") || has("comment") || has("document") || has("end-line") || has("source") || has("start-line") || o.Flags["as-bot"] || o.Flags["ensure-document"] || o.Flags["request-review"]
	content := has("content")
	if has("name") && word(0) != "tag" {
		return usageError("--name is only accepted by tag add.")
	}
	preview := (has("host") && o.Values["host"] != "127.0.0.1") || port != 3334 || o.Flags["no-open"] || o.Flags["keep-alive"] || o.Flags["trust-forwarded-prefix"] || has("max-depth") || has("max-files")
	if word(0) == "start" || len(o.Words) == 0 {
		if commentOptions || content || has("channel") {
			return usageError("Preview commands do not accept document, comment, or update options.")
		}
		if len(o.Words) > 2 {
			return usageError("Only one preview source is accepted.")
		}
		return nil
	}
	if word(0) == "update" {
		if len(o.Words) != 1 {
			return usageError("update does not accept positional arguments.")
		}
		if commentOptions || content || preview {
			return usageError("update does not accept preview, document, or comment options.")
		}
		if has("channel") && o.Values["channel"] != "stable" && o.Values["channel"] != "nightly" {
			return usageError("Invalid update channel: %s.", o.Values["channel"])
		}
		return nil
	}
	if preview {
		return usageError("This command does not accept preview options.")
	}
	target := func() error {
		if has("document") {
			if _, err := positive(o.Values["document"], "Document ID"); err != nil {
				return err
			}
		}
		if has("document") == has("source") {
			return usageError("Specify exactly one of --document or --source.")
		}
		return nil
	}
	switch word(0) {
	case "tag":
		if commentOptions || content || has("channel") {
			return usageError("tag commands do not accept document, comment, content, or update options.")
		}
		if word(1) == "add" && len(o.Words) == 2 {
			if !has("name") {
				return usageError("--name is required.")
			}
			return nil
		}
		if has("name") {
			return usageError("--name is only accepted by tag add.")
		}
		if word(1) == "list" && len(o.Words) == 2 {
			return nil
		}
		if word(1) == "delete" && len(o.Words) == 3 {
			n, err := positive(word(2), "Tag ID")
			if err != nil {
				return err
			}
			if n > 9007199254740991 {
				return usageError("Tag ID must be a positive safe integer.")
			}
			return nil
		}
		return usageError("Invalid tag command.")
	case "document":
		if word(1) == "tag" {
			if content || has("channel") || has("body") || has("comment") || has("start-line") || has("end-line") || o.Flags["as-bot"] || o.Flags["ensure-document"] || o.Flags["request-review"] {
				return usageError("document tag commands do not accept comment, content, or update options.")
			}
			if (word(2) != "add" && word(2) != "delete") || len(o.Words) < 4 {
				return usageError("document tag add/delete requires at least one tag ID.")
			}
			if err := target(); err != nil {
				return err
			}
			safe := true
			if has("document") {
				n, _ := positive(o.Values["document"], "Document ID")
				safe = n <= 9007199254740991
			}
			for _, v := range o.Words[3:] {
				n, err := positive(v, "Tag ID")
				if err != nil {
					return err
				}
				safe = safe && n <= 9007199254740991
			}
			if !safe {
				return usageError("Document and tag IDs must be positive safe integers.")
			}
			return nil
		}
		if commentOptions || content || has("channel") {
			return usageError("document commands do not accept comment or update options.")
		}
		if word(1) == "list" && len(o.Words) == 2 {
			return nil
		}
		if word(1) == "add" && len(o.Words) == 3 {
			return nil
		}
		if word(1) == "inspect" && len(o.Words) == 3 {
			_, err := positive(word(2), "Document ID")
			return err
		}
		return usageError("Invalid document command.")
	case "instruction", "memory":
		kind := word(0)
		if kind == "instruction" {
			replacement := ""
			switch word(1) {
			case "list":
				replacement = "get"
			case "add", "update":
				replacement = "set --content <text>"
			case "delete", "clear":
				replacement = "set --content \"\""
			}
			if replacement != "" {
				return usageError("instruction %s is no longer supported. Use instruction %s instead.", word(1), replacement)
			}
		}
		if has("channel") {
			return usageError("--channel is only accepted by update.")
		}
		if has("body") || has("comment") || has("start-line") || has("end-line") || o.Flags["as-bot"] || o.Flags["ensure-document"] || o.Flags["request-review"] {
			return usageError("%s commands do not accept comment options or --ensure-document.", kind)
		}
		if o.Flags["global"] {
			if has("document") || has("source") {
				return usageError("Specify exactly one of --global, --document, or --source.")
			}
		} else if err := target(); err != nil {
			return err
		}
		if kind == "instruction" {
			if len(o.Words) != 2 {
				return usageError("instruction commands accept no instruction ID or extra arguments.")
			}
			switch word(1) {
			case "get":
				if content {
					return usageError("instruction %s does not accept --content.", word(1))
				}
				return nil
			case "set":
				if !content {
					return usageError("--content is required.")
				}
				if o.Values["content"] != "" && u.TrimSpace(o.Values["content"]) == "" {
					return usageError("Instruction content must not contain only whitespace. Use --content \"\" to clear it.")
				}
				return nil
			default:
				return usageError("Invalid instruction command. Use get or set.")
			}
		}
		if word(1) == "list" && len(o.Words) == 2 {
			if content {
				return usageError("%s list does not accept --content.", kind)
			}
			return nil
		}
		if word(1) == "add" && len(o.Words) == 2 {
			if !content {
				return usageError("--content is required.")
			}
			return nil
		}
		if (word(1) == "update" || word(1) == "delete") && len(o.Words) == 3 {
			if word(1) == "update" && !content {
				return usageError("--content is required.")
			}
			if word(1) == "delete" && content {
				return usageError("%s delete does not accept --content.", kind)
			}
			_, err := positive(word(2), strings.ToUpper(kind[:1])+kind[1:]+" ID")
			return err
		}
		return usageError("Invalid %s command.", kind)
	case "comment":
		if has("channel") {
			return usageError("--channel is only accepted by update.")
		}
		if content {
			return usageError("--content is only accepted by instruction commands.")
		}
		if err := target(); err != nil {
			return err
		}
		if has("comment") {
			if _, err := positive(o.Values["comment"], "Comment ID"); err != nil {
				return err
			}
		}
		if o.Flags["ensure-document"] && word(1) != "add" {
			return usageError("--ensure-document is only accepted by comment add.")
		}
		switch word(1) {
		case "list":
			if len(o.Words) == 2 {
				return nil
			}
		case "add":
			if len(o.Words) == 2 {
				if o.Values["body"] == "" {
					return usageError("--body is required.")
				}
				if !has("start-line") {
					return usageError("--start-line is required.")
				}
				start, err := positive(o.Values["start-line"], "Comment start line")
				if err != nil {
					return err
				}
				if has("end-line") {
					end, err := positive(o.Values["end-line"], "Comment end line")
					if err != nil {
						return err
					}
					if end < start {
						return usageError("Comment end line must not precede the start line.")
					}
				}
				if o.Flags["ensure-document"] && o.Values["source"] == "" {
					return usageError("--ensure-document requires --source.")
				}
				return nil
			}
		case "reply":
			if !has("comment") {
				return usageError("--comment is required.")
			}
			if word(2) == "add" && len(o.Words) == 3 {
				if o.Values["body"] == "" {
					return usageError("--body is required.")
				}
				if o.Flags["request-review"] && !o.Flags["as-bot"] {
					return usageError("--request-review requires --as-bot.")
				}
				return nil
			}
			if (word(2) == "update" || word(2) == "delete") && len(o.Words) == 4 {
				if _, err := positive(word(3), "Reply ID"); err != nil {
					return err
				}
				if word(2) == "update" && o.Values["body"] == "" {
					return usageError("--body is required.")
				}
				return nil
			}
			return usageError("Invalid comment reply command.")
		case "update", "delete":
			if len(o.Words) != 3 {
				return usageError("comment %s requires one comment ID.", word(1))
			}
			if word(1) == "update" && o.Values["body"] == "" {
				return usageError("--body is required.")
			}
			_, err := positive(word(2), "Comment ID")
			return err
		case "resolve", "reopen":
			if len(o.Words) < 3 {
				return usageError("comment %s requires at least one comment ID.", word(1))
			}
			for _, v := range o.Words[2:] {
				if _, err := positive(v, "Comment ID"); err != nil {
					return err
				}
			}
			return nil
		}
		return usageError("Invalid comment command.")
	}
	return usageError("Invalid command: %s", word(0))
}

// JavaScript Number accepts integral decimal/exponent and hexadecimal spellings.
func cliInteger(value string) (int64, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, nil
	}
	if len(value) > 2 && value[0] == '0' && strings.ContainsAny(value[1:2], "xXoObB") {
		n, err := strconv.ParseInt(value, 0, 64)
		return n, err
	}
	n, err := strconv.ParseFloat(value, 64)
	if err != nil || math.IsNaN(n) || math.IsInf(n, 0) || math.Trunc(n) != n || n >= math.Exp2(63) || n < 0 {
		return 0, fmt.Errorf("invalid integer")
	}
	return int64(n), nil
}
