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
	case "CreateInstruction", "UpdateInstruction":
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
