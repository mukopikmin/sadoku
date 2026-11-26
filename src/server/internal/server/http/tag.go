package http

import (
	"encoding/json"

	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func decodeTagPatch(fields map[string]json.RawMessage) (u.TagPatch, error) {
	var patch u.TagPatch
	for _, name := range []string{"name", "backgroundColor"} {
		if string(fields[name]) == "null" {
			return patch, u.Fail("invalid_argument", "Tag values must be strings.")
		}
	}
	for _, field := range []struct {
		name  string
		value **string
	}{{"name", &patch.Name}, {"backgroundColor", &patch.BackgroundColor}} {
		if raw, ok := fields[field.name]; ok {
			if err := json.Unmarshal(raw, field.value); err != nil {
				return patch, u.Fail("invalid_argument", "Request body must be valid JSON.")
			}
		}
	}
	if patch.Name == nil && patch.BackgroundColor == nil {
		return patch, u.Fail("invalid_argument", "Tag name or background color is required.")
	}
	return patch, nil
}
