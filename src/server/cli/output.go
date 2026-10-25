package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strings"

	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

// CLI output has its own contract; API and storage models include extra fields.
// Preserve the insertion order of the original JavaScript objects as well.
type field struct {
	name  string
	value any
}
type object []field

func (o object) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, f := range o {
		if i > 0 {
			b.WriteByte(',')
		}
		name, _ := json.Marshal(f.name)
		b.Write(name)
		b.WriteByte(':')
		var value bytes.Buffer
		enc := json.NewEncoder(&value)
		enc.SetEscapeHTML(false)
		if err := enc.Encode(f.value); err != nil {
			return nil, err
		}
		b.Write(bytes.TrimSuffix(value.Bytes(), []byte("\n")))
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

func printJSON(out io.Writer, value any) error {
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(value); err != nil {
		return err
	}
	// JSON.stringify emits these Unicode characters literally. Only replace JSON
	// escapes, leaving user strings containing a literal backslash untouched.
	s := b.String()
	var result strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] == '\\' && i+1 < len(s) {
			if strings.HasPrefix(s[i:], `\u2028`) {
				result.WriteRune('\u2028')
				i += 5
				continue
			}
			if strings.HasPrefix(s[i:], `\u2029`) {
				result.WriteRune('\u2029')
				i += 5
				continue
			}
			result.WriteString(s[i : i+2])
			i++
			continue
		}
		result.WriteByte(s[i])
	}
	_, err := io.WriteString(out, result.String())
	return err
}

func documentOutput(d u.Document, withTags bool) object {
	o := object{{"filePath", d.FilePath}, {"id", d.ID}}
	if d.DisplayTitle != nil {
		o = append(o, field{"displayTitle", *d.DisplayTitle})
	}
	if withTags {
		tags := []object{}
		for _, t := range sortedTags(d.Tags) {
			tags = append(tags, object{{"backgroundColor", t.BackgroundColor}, {"id", t.ID}, {"name", t.Name}})
		}
		o = append(o, field{"tags", tags})
	}
	return o
}
func tagOutput(t u.Tag, summary bool) object {
	o := object{{"id", t.ID}, {"name", t.Name}, {"backgroundColor", t.BackgroundColor}, {"createdAt", t.CreatedAt}, {"updatedAt", t.UpdatedAt}}
	if summary {
		o = append(o, field{"documentCount", t.DocumentCount})
	}
	return o
}
func noteOutput(n u.Note) object {
	return object{{"content", n.Content}, {"createdAt", n.CreatedAt}, {"documentId", n.DocumentID}, {"id", n.ID}, {"updatedAt", n.UpdatedAt}}
}
func replyOutput(r u.Reply, created bool) object {
	o := object{{"author", r.Author}, {"body", r.Body}, {"createdAt", r.CreatedAt}, {"id", r.ID}}
	if !created && r.ReviewRequested {
		o = append(o, field{"reviewRequested", true})
	}
	o = append(o, field{"updatedAt", r.UpdatedAt})
	if created && r.ReviewRequested {
		o = append(o, field{"reviewRequested", true})
	}
	return o
}
func commentOutput(c u.Comment, operation string) object {
	replies := []object{}
	for i, r := range c.Replies {
		replies = append(replies, replyOutput(r, operation == "CreateReply" && i == len(c.Replies)-1))
	}
	if operation == "CreateComment" {
		return object{{"author", c.Author}, {"body", c.Body}, {"createdAt", c.CreatedAt}, {"updatedAt", c.UpdatedAt}, {"id", c.ID}, {"startLine", c.StartLine}, {"endLine", c.EndLine}, {"originalStartLine", c.OriginalStartLine}, {"originalEndLine", c.OriginalEndLine}, {"replies", replies}, {"resolved", c.Resolved}, {"stale", c.Stale}, {"sourceText", c.SourceText}, {"sourceHash", c.SourceHash}, {"currentSourceText", c.CurrentSourceText}}
	}
	o := object{{"author", c.Author}, {"body", c.Body}, {"createdAt", c.CreatedAt}, {"endLine", c.EndLine}, {"id", c.ID}, {"originalEndLine", c.OriginalEndLine}, {"originalStartLine", c.OriginalStartLine}, {"replies", replies}, {"resolved", c.Resolved}}
	// Resolution adds these fields at the end when they were absent in storage.
	if operation != "Resolve" {
		if c.ResolvedAt != nil {
			o = append(o, field{"resolvedAt", *c.ResolvedAt})
		}
		if c.ResolvedBy != nil {
			o = append(o, field{"resolvedBy", *c.ResolvedBy})
		}
	}
	if c.SourceHash != nil {
		o = append(o, field{"sourceHash", *c.SourceHash})
	}
	if c.SourceText != nil {
		o = append(o, field{"sourceText", *c.SourceText})
	}
	if c.SourceDeleted && operation != "ListCommentsRebased" {
		o = append(o, field{"sourceDeleted", true})
	}
	o = append(o, field{"stale", c.Stale}, field{"startLine", c.StartLine}, field{"updatedAt", c.UpdatedAt})
	if operation == "Resolve" {
		if c.ResolvedAt != nil {
			o = append(o, field{"resolvedAt", *c.ResolvedAt})
		}
		if c.ResolvedBy != nil {
			o = append(o, field{"resolvedBy", *c.ResolvedBy})
		}
	}
	if operation == "UpdateComment" || operation == "CreateReply" || operation == "UpdateReply" {
		if c.CurrentSourceText != nil {
			o = append(o, field{"currentSourceText", *c.CurrentSourceText})
		}
	}
	if (strings.HasPrefix(operation, "ListComments") && operation != "ListCommentsStale") || operation == "CreateReply" {
		o = append(o, field{"displayLine", c.StartLine})
	}
	if operation == "ListCommentsRebased" && c.SourceDeleted {
		o = append(o, field{"sourceDeleted", true})
	}
	return o
}

// Usage errors print the same help block on stderr as the original CLI.
type UsageError struct{ message string }

func (e *UsageError) Error() string               { return e.message }
func usageError(format string, args ...any) error { return &UsageError{fmt.Sprintf(format, args...)} }
func WriteError(out io.Writer, err error) {
	fmt.Fprintln(out, err)
	if _, ok := err.(*UsageError); ok {
		io.WriteString(out, Usage+"\n")
	}
}

func sortedTags(tags []u.Tag) []u.Tag {
	result := append([]u.Tag{}, tags...)
	sort.SliceStable(result, func(i, j int) bool { return result[i].Name < result[j].Name })
	return result
}
