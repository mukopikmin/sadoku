package cli

import (
	"fmt"
	"strings"
)

func validate(o Options) error {
	words := o.Words
	if len(words) == 0 {
		return fmt.Errorf("missing command")
	}
	allowed := map[string]bool{"help": true, "version": true}
	allow := func(keys ...string) {
		for _, key := range keys {
			allowed[key] = true
		}
	}
	count := func(n int) error {
		if len(words) != n {
			return fmt.Errorf("unexpected number of arguments")
		}
		return nil
	}
	need := func(key string) error {
		if _, ok := o.Values[key]; !ok {
			return fmt.Errorf("--%s is required", key)
		}
		return nil
	}
	if words[0] == "start" {
		allow("host", "port", "max-depth", "max-files", "no-open", "keep-alive", "trust-forwarded-prefix")
		if err := count(2); err != nil {
			return err
		}
	} else if words[0] == "update" {
		allow("channel")
		if err := count(1); err != nil {
			return err
		}
	} else {
		if len(words) < 2 {
			return fmt.Errorf("missing operation")
		}
		kind, operation := words[0], words[1]
		switch kind {
		case "tag":
			switch operation {
			case "add":
				allow("name")
				if err := need("name"); err != nil {
					return err
				}
				if err := count(2); err != nil {
					return err
				}
			case "list":
				if err := count(2); err != nil {
					return err
				}
			case "delete":
				if err := count(3); err != nil {
					return err
				}
			default:
				return fmt.Errorf("invalid tag operation")
			}
		case "document":
			switch operation {
			case "list":
				if err := count(2); err != nil {
					return err
				}
			case "inspect":
				if err := count(3); err != nil {
					return err
				}
			case "add":
				allow("create", "title")
				if strings.ContainsAny(o.Values["title"], "\r\n\x00") {
					return fmt.Errorf("title must be a single line")
				}
				if err := count(3); err != nil {
					return err
				}
			case "tag":
				allow("source", "document")
				if len(words) < 4 || (words[2] != "add" && words[2] != "delete") {
					return fmt.Errorf("document tag add/delete requires tag IDs")
				}
			default:
				return fmt.Errorf("invalid document operation")
			}
		case "instruction", "memory":
			allow("source", "document")
			switch operation {
			case "list":
				if err := count(2); err != nil {
					return err
				}
			case "add", "update":
				allow("content")
				if strings.TrimSpace(o.Values["content"]) == "" {
					return fmt.Errorf("--content is required")
				}
				n := 2
				if operation == "update" {
					n = 3
				}
				if err := count(n); err != nil {
					return err
				}
			case "delete":
				if err := count(3); err != nil {
					return err
				}
			default:
				return fmt.Errorf("invalid note operation")
			}
		case "comment":
			allow("source", "document")
			switch operation {
			case "list":
				if err := count(2); err != nil {
					return err
				}
			case "add":
				allow("body", "start-line", "end-line", "as-bot", "ensure-document")
				if err := count(2); err != nil {
					return err
				}
				start, err := number(o.Values["start-line"], "start line", 1)
				if err != nil {
					return err
				}
				if value, ok := o.Values["end-line"]; ok {
					end, err := number(value, "end line", 1)
					if err != nil {
						return err
					}
					if end < start {
						return fmt.Errorf("end line must not precede start line")
					}
				}
				if strings.TrimSpace(o.Values["body"]) == "" {
					return fmt.Errorf("--body is required")
				}
				if o.Flags["ensure-document"] && o.Values["source"] == "" {
					return fmt.Errorf("--ensure-document requires --source")
				}
			case "update":
				allow("body")
				if strings.TrimSpace(o.Values["body"]) == "" {
					return fmt.Errorf("--body is required")
				}
				if err := count(3); err != nil {
					return err
				}
			case "delete":
				if err := count(3); err != nil {
					return err
				}
			case "resolve", "reopen":
				allow("as-bot")
				if len(words) < 3 {
					return fmt.Errorf("comment IDs are required")
				}
			case "reply":
				allow("comment")
				if len(words) < 3 {
					return fmt.Errorf("missing reply operation")
				}
				if _, err := number(o.Values["comment"], "comment ID", 1); err != nil {
					return err
				}
				switch words[2] {
				case "add":
					allow("body", "as-bot", "request-review")
					if err := count(3); err != nil {
						return err
					}
					if strings.TrimSpace(o.Values["body"]) == "" {
						return fmt.Errorf("--body is required")
					}
					if o.Flags["request-review"] && !o.Flags["as-bot"] {
						return fmt.Errorf("--request-review requires --as-bot")
					}
				case "update":
					allow("body")
					if err := count(4); err != nil {
						return err
					}
					if strings.TrimSpace(o.Values["body"]) == "" {
						return fmt.Errorf("--body is required")
					}
				case "delete":
					if err := count(4); err != nil {
						return err
					}
				default:
					return fmt.Errorf("invalid reply operation")
				}
			default:
				return fmt.Errorf("invalid comment operation")
			}
		default:
			return fmt.Errorf("invalid command: %s", kind)
		}
	}
	for key := range o.Values {
		if !allowed[key] {
			return fmt.Errorf("--%s is not accepted by this command", key)
		}
	}
	for key := range o.Flags {
		if !allowed[key] {
			return fmt.Errorf("--%s is not accepted by this command", key)
		}
	}
	return nil
}
