package http

import (
	"encoding/json"
	"math"

	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

const invalidSettingsMessage = "Request body must contain valid theme, codeWrap, fontScale, maxDepth, maxFiles, excludedDirectories, markdownExtensions, and showHtmlComments settings."

func validateRESTFields(operation string, fields map[string]json.RawMessage) error {
	invalid := func(message string) error { return u.Fail("invalid_argument", message) }
	value := func(name string) any { var result any; json.Unmarshal(fields[name], &result); return result }
	switch operation {
	case "CreateInstruction", "UpdateInstruction", "CreateGlobalInstruction", "UpdateGlobalInstruction":
		if _, ok := value("content").(string); !ok {
			return invalid("Request body must contain an instruction content string.")
		}
	case "CreateComment":
		for _, field := range []string{"startLine", "endLine"} {
			n, ok := value(field).(float64)
			if !ok || n < 1 || math.Trunc(n) != n {
				return invalid("Comment " + field + " must be a positive integer.")
			}
		}
		if value("endLine").(float64) < value("startLine").(float64) {
			return invalid("Comment endLine must be greater than or equal to startLine.")
		}
	case "ReplaceDocumentTags":
		tags, ok := value("tags").([]any)
		if !ok {
			return invalid("Tags must be an array.")
		}
		if len(tags) > 20 {
			return invalid("A document can have at most 20 tags.")
		}
		for _, tag := range tags {
			reference, ok := tag.(map[string]any)
			if !ok {
				return invalid("Each tag must contain an id or name.")
			}
			id, hasID := reference["id"]
			name, hasName := reference["name"]
			if hasID {
				n, ok := id.(float64)
				if hasName || !ok || n < 1 || n > 9007199254740991 || math.Trunc(n) != n {
					return invalid("Each tag must contain either an id or name.")
				}
			} else {
				text, ok := name.(string)
				if !hasName || !ok {
					return invalid("Tag name must be a string.")
				}
				if err := u.ValidateTagName(text); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// REST handlers read only their own fields. Decode numbers through float64 to
// preserve JavaScript JSON.parse semantics (1, 1.0, and 1e0 are the same value).
func decodeRESTInput(operation string, fields map[string]json.RawMessage, target any) error {
	var names []string
	switch operation {
	case "UpdateSettings":
		names = []string{"theme", "codeWrap", "fontScale", "maxDepth", "maxFiles", "excludedDirectories", "markdownExtensions", "showHtmlComments", "showHighlightBoundaries"}
	case "UpdateTag":
		names = []string{"name", "backgroundColor"}
	case "ReplaceDocumentTags":
		names = []string{"tags"}
	case "CreateInstruction", "UpdateInstruction", "CreateGlobalInstruction", "UpdateGlobalInstruction":
		names = []string{"content"}
	case "CreateComment":
		names = []string{"body", "startLine", "endLine"}
	case "UpdateComment", "CreateReply", "UpdateReply":
		names = []string{"body"}
	case "ExportCommentToGitHub":
		names = []string{"body", "headSha", "displayedMarkdown", "createdAt", "startLine", "endLine"}
	}
	values := map[string]any{}
	for _, name := range names {
		if data, ok := fields[name]; ok {
			var value any
			if err := json.Unmarshal(data, &value); err != nil {
				return err
			}
			values[name] = value
		}
	}
	if tags, ok := values["tags"].([]any); ok {
		for i, value := range tags {
			if tag, ok := value.(map[string]any); ok {
				reference := map[string]any{}
				for _, name := range []string{"id", "name"} {
					if value, ok := tag[name]; ok {
						reference[name] = value
					}
				}
				tags[i] = reference
			}
		}
	}
	data, err := json.Marshal(values)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}
