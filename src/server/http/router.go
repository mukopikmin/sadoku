package http

import (
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"regexp"
	"strings"

	"connectrpc.com/connect"
	"github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1/previewv1connect"
	"github.com/mukopikmin/sadoku/src/preview"
	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/http/api"
	"github.com/mukopikmin/sadoku/src/server/session"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

type Options struct {
	TrustForwardedPrefix        bool
	Log                         func(string)
	OnStreamOpen, OnStreamClose func()
}
type entry struct {
	File        string
	CSS, Assets []string
}
type router struct {
	session   *session.Session
	options   Options
	assets    fs.FS
	manifest  map[string]entry
	mux       *http.ServeMux
	immutable map[string]bool
}

func New(s *session.Session, options Options) (http.Handler, error) {
	assets, err := fs.Sub(preview.Assets, "dist")
	if err != nil {
		return nil, err
	}
	b, err := fs.ReadFile(assets, ".vite/manifest.json")
	if err != nil {
		return nil, err
	}
	r := &router{session: s, options: options, assets: assets, manifest: map[string]entry{}, mux: http.NewServeMux(), immutable: map[string]bool{}}
	if err = json.Unmarshal(b, &r.manifest); err != nil {
		return nil, err
	}
	if r.manifest["main.tsx"].File == "" {
		return nil, fmt.Errorf("missing preview entry point")
	}
	for _, e := range r.manifest {
		files := append([]string{e.File}, e.CSS...)
		files = append(files, e.Assets...)
		for _, file := range files {
			if regexp.MustCompile(`-[A-Za-z0-9_-]{8}\.[a-zA-Z0-9]+$`).MatchString(file) {
				r.immutable[file] = true
			}
		}
	}
	servicePath, handler := previewv1connect.NewPreviewServiceHandler(&api.Service{Session: s}, connect.WithReadMaxBytes(32<<20), connect.WithRequireConnectProtocolHeader())
	r.mux.Handle(servicePath, handler)
	r.mux.HandleFunc("/", r.handle)
	return r, nil
}

var prefixPattern = regexp.MustCompile(`^/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+$`)

func (r *router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if r.options.TrustForwardedPrefix {
		prefix := req.Header.Get("X-Forwarded-Prefix")
		if prefix != "" && (len(prefix) > 2048 || !prefixPattern.MatchString(prefix)) {
			respondError(w, u.Fail("invalid_argument", "Invalid public base path."))
			return
		}
	}
	if validateRPC(w, req) {
		if req.URL.Path == "/sadoku.preview.v1.PreviewService/CreateDocument" && strings.HasPrefix(strings.ToLower(req.Header.Get("Content-Type")), "application/json") {
			response := &creationResponse{ResponseWriter: w}
			r.mux.ServeHTTP(response, req)
			response.finish()
		} else {
			r.mux.ServeHTTP(w, req)
		}
	}
}
func respond(w http.ResponseWriter, status int, value any) {
	if status == 204 {
		w.Header().Del("Content-Type")
	} else {
		w.Header().Set("Content-Type", "application/json")
	}
	w.WriteHeader(status)
	if status != 204 {
		json.NewEncoder(w).Encode(value)
	}
}

func textError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(status)
	io.WriteString(w, message)
}
func respondError(w http.ResponseWriter, err error) {
	var failure *u.Failure
	status, message := 500, "Internal Server Error"
	if errors.As(err, &failure) {
		message = failure.Message
		switch failure.Kind {
		case "invalid_argument":
			status = 400
		case "not_found":
			status = 404
		case "already_exists", "aborted":
			status = 409
		case "failed_precondition":
			status = 400
		case "unimplemented":
			status = 501
		}
	}
	textError(w, message, status)
}
func (r *router) handle(w http.ResponseWriter, req *http.Request) {
	p := req.URL.Path
	if strings.HasPrefix(p, "/assets/") {
		r.asset(w, req)
		return
	}
	if strings.HasPrefix(p, "/assets") {
		textError(w, "Asset not found.", 404)
		return
	}
	if strings.HasPrefix(p, "/__sadoku") {
		r.rest(w, req)
		return
	}
	if req.Method != "GET" && req.Method != "HEAD" {
		textError(w, "Method not allowed.", 405)
		return
	}
	prefix := ""
	if r.options.TrustForwardedPrefix {
		prefix = req.Header.Get("X-Forwarded-Prefix")
	}
	e := r.manifest["main.tsx"]
	var css strings.Builder
	for _, file := range e.CSS {
		fmt.Fprintf(&css, `<link rel="stylesheet" href="%s/assets/%s">`, prefix, html.EscapeString(file))
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!doctype html><html lang="und"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="%s/assets/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="%s/assets/icon-512.png">%s<title>Sadoku</title></head><body><div id="sadoku-client-root" data-base-path="%s"></div><script type="module" src="%s/assets/%s"></script></body></html>`, prefix, prefix, css.String(), prefix, prefix, html.EscapeString(e.File))
}
func (r *router) asset(w http.ResponseWriter, req *http.Request) {
	if req.Method != "GET" && req.Method != "HEAD" {
		textError(w, "Method not allowed.", 405)
		return
	}
	name := strings.TrimPrefix(req.URL.Path, "/assets/")
	if !fs.ValidPath(name) || strings.Contains(name, "..") || strings.ContainsAny(name, "\\\x00") {
		textError(w, "Asset not found.", 404)
		return
	}
	b, err := fs.ReadFile(r.assets, name)
	if err != nil {
		textError(w, "Asset not found.", 404)
		return
	}
	contentType := mime.TypeByExtension(path.Ext(name))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", contentType)
	if r.immutable[name] {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	w.Write(b)
}
func (r *router) rest(w http.ResponseWriter, req *http.Request) {
	parts := strings.Split(strings.TrimPrefix(req.URL.Path, "/__sadoku/"), "/")
	export := req.Method == "POST" && len(parts) == 5 && parts[0] == "documents" && parts[2] == "comments" && parts[4] == "github"
	if len(parts) >= 2 && parts[0] == "documents" {
		id, err := parseRESTResourceID(parts[1])
		if err != nil || !regexp.MustCompile(`^[1-9][0-9]*$`).MatchString(parts[1]) || u.PositiveID(id) != nil {
			if export {
				githubExportError(w, "export_document_not_found", 0)
			} else {
				respondError(w, u.Fail("not_found", "Document not found."))
			}
			return
		}
		if export {
			if r.session.ExportInProgress() {
				githubExportError(w, "export_busy", 0)
				return
			}
			r.session.Mu.Lock()
			_, findErr := r.session.Find(id)
			available := r.session.GitHub != nil
			r.session.Mu.Unlock()
			if findErr != nil {
				githubExportError(w, "export_document_not_found", 0)
				return
			}
			if !available {
				githubExportError(w, "export_unavailable", 404)
				return
			}
			commentID, err := parseRESTResourceID(parts[3])
			if err != nil || u.PositiveID(commentID) != nil {
				githubExportError(w, "export_comment_not_found", 0)
				return
			}
		}
	}
	operation := ""
	input := session.Input{}
	method := req.Method
	status := 200
	if len(parts) == 1 {
		switch parts[0] {
		case "events":
			if method != "GET" {
				textError(w, "Method not allowed.", 405)
				return
			}
			r.events(w, req, 0)
			return
		case "documents":
			if method == "GET" {
				operation = "ListDocuments"
			}
		case "settings":
			if method == "GET" {
				operation = "GetSettings"
			}
			if method == "PUT" {
				operation = "UpdateSettings"
			}
		case "directory-status":
			if method == "GET" {
				operation = "GetDirectoryStatus"
			}
		case "github-account":
			if method == "GET" {
				operation = "GetGitHubAccount"
			}
		case "tags":
			if method == "GET" {
				operation = "ListTags"
			}
		}
	}
	if len(parts) == 2 && parts[0] == "tags" {
		n, _ := parseRESTResourceID(parts[1])
		input.ID = session.ID(n)
		if method == "DELETE" {
			operation = "DeleteTag"
			status = 204
		}
		if method == "PATCH" {
			operation = "UpdateTag"
		}
	}
	if len(parts) >= 2 && parts[0] == "documents" {
		id, _ := parseRESTResourceID(parts[1])
		input.DocumentID = session.ID(id)
		if len(parts) == 2 && method == "GET" {
			operation = "GetDocument"
		}
		if len(parts) >= 3 {
			switch parts[2] {
			case "events":
				if len(parts) == 3 && method == "GET" {
					r.events(w, req, id)
					return
				}
			case "tags":
				if len(parts) == 3 && method == "PUT" {
					operation = "ReplaceDocumentTags"
				}
			case "instructions", "memories":
				kind := "Instruction"
				if parts[2] == "memories" {
					kind = "Memory"
				}
				if len(parts) == 3 {
					if method == "GET" {
						operation = "ListInstructions"
						if kind == "Memory" {
							operation = "ListMemories"
						}
					}
					if method == "POST" && kind == "Instruction" {
						operation = "CreateInstruction"
						status = 201
					}
				}
				if len(parts) == 4 {
					n, _ := parseRESTResourceID(parts[3])
					input.InstructionID = session.ID(n)
					input.MemoryID = session.ID(n)
					if method == "PUT" && kind == "Instruction" {
						operation = "UpdateInstruction"
					}
					if method == "DELETE" {
						operation = "Delete" + kind
						status = 204
					}
				}
			case "comments":
				if len(parts) == 3 {
					if method == "GET" {
						operation = "ListComments"
					}
					if method == "POST" {
						operation = "CreateComment"
					}
				}
				if len(parts) >= 4 {
					n, _ := parseRESTResourceID(parts[3])
					input.CommentID = session.ID(n)
					if len(parts) == 4 {
						if method == "PUT" {
							operation = "UpdateComment"
						}
						if method == "DELETE" {
							operation = "DeleteComment"
							status = 204
						}
					}
					if len(parts) == 5 && method == "POST" {
						switch parts[4] {
						case "resolve", "reopen":
							operation = "SetCommentResolution"
							input.Resolved = parts[4] == "resolve"
						case "replies":
							operation = "CreateReply"
						case "github":
							operation = "ExportCommentToGitHub"
						}
					}
					if len(parts) == 6 && parts[4] == "replies" {
						n, _ := parseRESTResourceID(parts[5])
						input.ReplyID = session.ID(n)
						if method == "PUT" {
							operation = "UpdateReply"
						}
						if method == "DELETE" {
							operation = "DeleteReply"
							status = 204
						}
					}
				}
			}
		}
	}
	if operation == "" {
		known := len(parts) > 0 && (parts[0] == "settings" || parts[0] == "tags" || parts[0] == "documents" || parts[0] == "github-account" || parts[0] == "directory-status")
		if known {
			textError(w, "Method not allowed.", 405)
		} else {
			textError(w, "Not found.", 404)
		}
		return
	}
	if req.Body != nil && (method == "POST" || method == "PUT" || method == "PATCH") && operation != "SetCommentResolution" {
		invalidBody := func(message string) {
			if export {
				githubExportError(w, "export_invalid_request", 0)
			} else {
				textError(w, message, 400)
			}
		}
		if strings.ToLower(strings.TrimSpace(strings.Split(req.Header.Get("Content-Type"), ";")[0])) != "application/json" {
			if export {
				githubExportError(w, "export_json_required", 0)
			} else {
				textError(w, "Content-Type must be application/json.", 400)
			}
			return
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, req.Body, 32<<20))
		var fields map[string]json.RawMessage
		if err := decoder.Decode(&fields); err != nil || fields == nil {
			invalidBody("Request body must be valid JSON.")
			return
		}
		var trailing any
		if err := decoder.Decode(&trailing); err != io.EOF {
			invalidBody("Request body must be valid JSON.")
			return
		}
		if export {
			var displayed any
			if err := json.Unmarshal(fields["displayedMarkdown"], &displayed); err != nil {
				invalidBody("")
				return
			}
			if _, ok := displayed.(string); !ok {
				invalidBody("")
				return
			}
		}
		if err := validateRESTFields(operation, fields); err != nil {
			respondError(w, err)
			return
		}
		if operation == "UpdateSettings" {
			for _, value := range fields {
				if string(value) == "null" {
					textError(w, invalidSettingsMessage, 400)
					return
				}
			}
			for _, key := range []string{"theme", "codeWrap", "fontScale", "maxDepth", "maxFiles"} {
				if _, ok := fields[key]; !ok {
					textError(w, invalidSettingsMessage, 400)
					return
				}
			}
			allowed := map[string]bool{"theme": true, "codeWrap": true, "fontScale": true, "maxDepth": true, "maxFiles": true, "excludedDirectories": true, "markdownExtensions": true, "showHtmlComments": true}
			for key := range fields {
				if !allowed[key] {
					textError(w, invalidSettingsMessage, 400)
					return
				}
			}
			settings, _, err := config.Read()
			if err != nil {
				respondError(w, err)
				return
			}
			input.Settings = settings
		}
		if operation == "UpdateTag" {
			for _, key := range []string{"name", "backgroundColor"} {
				if value, ok := fields[key]; ok && string(value) == "null" {
					textError(w, "Tag values must be strings.", 400)
					return
				}
			}
			if _, name := fields["name"]; !name {
				if _, color := fields["backgroundColor"]; !color {
					textError(w, "Tag name or background color is required.", 400)
					return
				}
			}
			r.session.Mu.Lock()
			tags, tagErr := r.session.Repository.Tags(0)
			r.session.Mu.Unlock()
			if tagErr != nil {
				respondError(w, tagErr)
				return
			}
			for _, tag := range tags {
				if tag.ID == int64(input.ID) {
					input.Name = tag.Name
					input.BackgroundColor = tag.BackgroundColor
				}
			}
		}
		if err := decodeRESTInput(operation, fields, &input); err != nil {
			message := "Request body must be valid JSON."
			if operation == "UpdateSettings" {
				message = invalidSettingsMessage
			}
			invalidBody(message)
			return
		}
		// Route parameters always take precedence over JSON input.
		if len(parts) >= 2 {
			n, _ := parseRESTResourceID(parts[1])
			if parts[0] == "documents" {
				input.DocumentID = session.ID(n)
			} else if parts[0] == "tags" {
				input.ID = session.ID(n)
			}
		}
		if len(parts) >= 4 && parts[2] == "comments" {
			n, _ := parseRESTResourceID(parts[3])
			input.CommentID = session.ID(n)
		}
	}
	if len(parts) >= 4 && parts[0] == "documents" {
		n, _ := parseRESTResourceID(parts[3])
		if parts[2] == "instructions" {
			input.InstructionID = session.ID(n)
		}
		if parts[2] == "memories" {
			input.MemoryID = session.ID(n)
		}
		if len(parts) == 6 && parts[2] == "comments" && parts[4] == "replies" {
			n, _ = parseRESTResourceID(parts[5])
			input.ReplyID = session.ID(n)
		}
	}
	result, err := r.session.Invoke(req.Context(), operation, input)
	if err != nil {
		if export {
			respondGitHubExportError(w, err)
		} else {
			respondError(w, err)
		}
		return
	}
	if operation == "ListDocuments" {
		documents := result.(map[string]any)["documents"].([]u.Document)
		summaries := make([]documentSummary, 0, len(documents))
		for _, document := range documents {
			summaries = append(summaries, documentSummary{document.ID, document.RelativePath, document.Title, document.DisplayTitle, document.Deleted, publicDocumentTags(document.Tags)})
		}
		result = summaries
	}
	if operation == "GetDocument" {
		document := result.(map[string]any)
		delete(document, "canRestore")
		delete(document, "previousMarkdown")
		document["tags"] = publicDocumentTags(document["tags"].([]u.Tag))
	}
	if operation == "UpdateTag" {
		tag := result.(u.Tag)
		result = map[string]any{"id": tag.ID, "name": tag.Name, "backgroundColor": tag.BackgroundColor, "createdAt": tag.CreatedAt, "updatedAt": tag.UpdatedAt}
	}
	if operation == "ListTags" || operation == "ReplaceDocumentTags" {
		result = result.(map[string]any)["tags"]
		if operation == "ReplaceDocumentTags" {
			tags := []map[string]any{}
			for _, tag := range result.([]u.Tag) {
				tags = append(tags, map[string]any{"id": tag.ID, "name": tag.Name, "backgroundColor": tag.BackgroundColor, "createdAt": tag.CreatedAt, "updatedAt": tag.UpdatedAt})
			}
			result = tags
		}
	}
	respond(w, status, result)
}

type documentTag struct {
	ID              int64  `json:"id"`
	Name            string `json:"name"`
	BackgroundColor string `json:"backgroundColor"`
}

type documentSummary struct {
	ID           int64         `json:"id"`
	RelativePath string        `json:"relativePath"`
	Title        string        `json:"title"`
	DisplayTitle *string       `json:"displayTitle,omitempty"`
	Deleted      bool          `json:"deleted"`
	Tags         []documentTag `json:"tags"`
}

func publicDocumentTags(tags []u.Tag) []documentTag {
	result := make([]documentTag, 0, len(tags))
	for _, tag := range tags {
		result = append(result, documentTag{tag.ID, tag.Name, tag.BackgroundColor})
	}
	return result
}
