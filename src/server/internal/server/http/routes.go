package http

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/mukopikmin/sadoku/internal/server/session"
	"github.com/mukopikmin/sadoku/internal/server/usecase"
)

func (r *router) registerREST(m chi.Router) {
	m.NotFound(r.restNotFound)
	m.MethodNotAllowed(r.restNotFound)
	m.Get("/events", func(w http.ResponseWriter, req *http.Request) { r.events(w, req, 0) })
	m.Get("/documents/{documentID}/events", func(w http.ResponseWriter, req *http.Request) {
		r.events(w, req, int64(restParameters(req).DocumentID))
	})

	bind := func(method, path, operation string, status int) {
		m.MethodFunc(method, path, func(w http.ResponseWriter, req *http.Request) {
			r.rest(w, req, operation, status)
		})
	}
	m.Get("/documents", r.listDocuments)
	bind("GET", "/settings", "GetSettings", 200)
	bind("PUT", "/settings", "UpdateSettings", 200)
	bind("GET", "/directory-status", "GetDirectoryStatus", 200)
	bind("GET", "/github-account", "GetGitHubAccount", 200)
	bind("GET", "/global-instructions", "ListGlobalInstructions", 200)
	bind("POST", "/global-instructions", "CreateGlobalInstruction", 201)
	bind("PUT", "/global-instructions/{instructionID}", "UpdateGlobalInstruction", 200)
	bind("DELETE", "/global-instructions/{instructionID}", "DeleteGlobalInstruction", 204)
	bind("GET", "/tags", "ListTags", 200)
	bind("PATCH", "/tags/{tagID}", "UpdateTag", 200)
	bind("DELETE", "/tags/{tagID}", "DeleteTag", 204)
	m.Get("/documents/{documentID}", r.getDocument)
	bind("PUT", "/documents/{documentID}/tags", "ReplaceDocumentTags", 200)
	bind("GET", "/documents/{documentID}/instructions", "ListInstructions", 200)
	bind("POST", "/documents/{documentID}/instructions", "CreateInstruction", 201)
	bind("PUT", "/documents/{documentID}/instructions/{instructionID}", "UpdateInstruction", 200)
	bind("DELETE", "/documents/{documentID}/instructions/{instructionID}", "DeleteInstruction", 204)
	bind("GET", "/documents/{documentID}/memories", "ListMemories", 200)
	bind("DELETE", "/documents/{documentID}/memories/{memoryID}", "DeleteMemory", 204)
	bind("GET", "/documents/{documentID}/comments", "ListComments", 200)
	bind("POST", "/documents/{documentID}/comments", "CreateComment", 200)
	bind("PUT", "/documents/{documentID}/comments/{commentID}", "UpdateComment", 200)
	bind("DELETE", "/documents/{documentID}/comments/{commentID}", "DeleteComment", 204)
	bind("POST", "/documents/{documentID}/comments/{commentID}/resolve", "SetCommentResolution", 200)
	bind("POST", "/documents/{documentID}/comments/{commentID}/reopen", "SetCommentResolution", 200)
	bind("POST", "/documents/{documentID}/comments/{commentID}/github", "ExportCommentToGitHub", 200)
	bind("POST", "/documents/{documentID}/comments/{commentID}/replies", "CreateReply", 200)
	bind("PUT", "/documents/{documentID}/comments/{commentID}/replies/{replyID}", "UpdateReply", 200)
	bind("DELETE", "/documents/{documentID}/comments/{commentID}/replies/{replyID}", "DeleteReply", 204)
}

func restParameters(req *http.Request) session.Input {
	id := func(name string) session.ID {
		n, _ := parseRESTResourceID(chi.URLParam(req, name))
		return session.ID(n)
	}
	return session.Input{
		DocumentID: id("documentID"), ID: id("tagID"),
		InstructionID: id("instructionID"), MemoryID: id("memoryID"),
		CommentID: id("commentID"), ReplyID: id("replyID"),
		Resolved: strings.HasSuffix(req.URL.Path, "/resolve"),
	}
}

var documentIDPattern = regexp.MustCompile(`^[1-9][0-9]*$`)
var exportPathPattern = regexp.MustCompile(`^/__sadoku/documents/[^/]*/comments/[^/]*/github$`)

// Validate IDs before dispatch to preserve errors even for unsupported methods
// and unknown child routes. Child IDs retain the legacy numeric syntax.
func (r *router) validateRESTPath(w http.ResponseWriter, req *http.Request) bool {
	if tail, ok := strings.CutPrefix(req.URL.Path, "/__sadoku/documents/"); ok {
		value, _, _ := strings.Cut(tail, "/")
		id, err := parseRESTResourceID(value)
		if err != nil || !documentIDPattern.MatchString(value) || usecase.PositiveID(id) != nil {
			if req.Method == "POST" && exportPathPattern.MatchString(req.URL.Path) {
				githubExportError(w, "export_document_not_found", 0)
			} else {
				respondError(w, usecase.Fail("not_found", "Document not found."))
			}
			return false
		}
	}
	if value, ok := strings.CutPrefix(req.URL.Path, "/__sadoku/global-instructions/"); ok && !strings.Contains(value, "/") {
		id, err := parseRESTResourceID(value)
		if err != nil || usecase.PositiveID(id) != nil {
			respondError(w, usecase.Fail("not_found", "Instruction not found."))
			return false
		}
	}
	return true
}

func (r *router) restNotFound(w http.ResponseWriter, req *http.Request) {
	resource, _, _ := strings.Cut(strings.TrimPrefix(req.URL.Path, "/__sadoku/"), "/")
	switch resource {
	case "events":
		if req.URL.Path == "/__sadoku/events" {
			textError(w, "Method not allowed.", 405)
			return
		}
	case "global-instructions", "settings", "tags", "documents", "github-account", "directory-status":
		textError(w, "Method not allowed.", 405)
		return
	}
	textError(w, "Not found.", 404)
}
