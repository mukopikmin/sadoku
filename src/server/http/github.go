package http

import (
	"encoding/json"
	"errors"
	"net/http"

	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

var githubExportStatuses = map[string]int{
	"export_review_out_of_sync": 409,
	"export_markdown_changed":   409,
	"export_unavailable":        409,
	"export_out_of_sync":        409,
	"export_comment_not_found":  404,
	"export_comment_ineligible": 409,
	"export_outside_diff":       409,
	"export_busy":               409,
	"export_json_required":      415,
	"export_invalid_request":    400,
	"export_document_not_found": 404,
	"export_failed":             502,
}

func githubExportError(w http.ResponseWriter, code string, status int) {
	if status == 0 {
		status = githubExportStatuses[code]
	}
	respond(w, status, map[string]any{"error": map[string]string{"code": code}})
}

func respondGitHubExportError(w http.ResponseWriter, err error) {
	var failure *u.Failure
	var value struct{ Error struct{ Code string } }
	if errors.As(err, &failure) && json.Unmarshal([]byte(failure.Message), &value) == nil {
		if _, ok := githubExportStatuses[value.Error.Code]; ok {
			githubExportError(w, value.Error.Code, 0)
			return
		}
	}
	githubExportError(w, "export_failed", 0)
}
