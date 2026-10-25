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
	"strconv"
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
	r.mux.ServeHTTP(w, req)
}
func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if status != 204 {
		json.NewEncoder(w).Encode(value)
	}
}
func respondError(w http.ResponseWriter, err error) {
	var failure *u.Failure
	status, message := 500, "Failed to process request."
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
	http.Error(w, message, status)
}
func (r *router) handle(w http.ResponseWriter, req *http.Request) {
	p := req.URL.Path
	if strings.HasPrefix(p, "/assets/") {
		r.asset(w, req)
		return
	}
	if strings.HasPrefix(p, "/assets") {
		http.Error(w, "Asset not found.", 404)
		return
	}
	if strings.HasPrefix(p, "/__sadoku") {
		r.rest(w, req)
		return
	}
	if req.Method != "GET" && req.Method != "HEAD" {
		http.Error(w, "Method not allowed.", 405)
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
		http.Error(w, "Method not allowed.", 405)
		return
	}
	name := strings.TrimPrefix(req.URL.Path, "/assets/")
	if !fs.ValidPath(name) || strings.Contains(name, "..") || strings.ContainsAny(name, "\\\x00") {
		http.Error(w, "Asset not found.", 404)
		return
	}
	b, err := fs.ReadFile(r.assets, name)
	if err != nil {
		http.Error(w, "Asset not found.", 404)
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
	operation := ""
	input := session.Input{}
	method := req.Method
	status := 200
	if len(parts) == 1 {
		switch parts[0] {
		case "events":
			if method != "GET" {
				http.Error(w, "Method not allowed.", 405)
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
		n, _ := strconv.ParseInt(parts[1], 10, 64)
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
		id, _ := strconv.ParseInt(parts[1], 10, 64)
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
					n, _ := strconv.ParseInt(parts[3], 10, 64)
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
						status = 201
					}
				}
				if len(parts) >= 4 {
					n, _ := strconv.ParseInt(parts[3], 10, 64)
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
							status = 201
						case "github":
							operation = "ExportCommentToGitHub"
						}
					}
					if len(parts) == 6 && parts[4] == "replies" {
						n, _ := strconv.ParseInt(parts[5], 10, 64)
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
			http.Error(w, "Method not allowed.", 405)
		} else {
			http.Error(w, "Not found.", 404)
		}
		return
	}
	if req.Body != nil && (method == "POST" || method == "PUT" || method == "PATCH") && operation != "SetCommentResolution" {
		if strings.Split(req.Header.Get("Content-Type"), ";")[0] != "application/json" {
			http.Error(w, "Content-Type must be application/json.", 400)
			return
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, req.Body, 32<<20))
		var fields map[string]json.RawMessage
		if err := decoder.Decode(&fields); err != nil || fields == nil {
			http.Error(w, "Request body must be valid JSON.", 400)
			return
		}
		var trailing any
		if err := decoder.Decode(&trailing); err != io.EOF {
			http.Error(w, "Request body must be valid JSON.", 400)
			return
		}
		if operation == "UpdateSettings" {
			for key, value := range fields {
				if string(value) == "null" {
					http.Error(w, "Settings must not contain null values: "+key, 400)
					return
				}
			}
			for _, key := range []string{"theme", "codeWrap", "fontScale", "maxDepth", "maxFiles"} {
				if _, ok := fields[key]; !ok {
					http.Error(w, "Request body must contain the complete preview settings.", 400)
					return
				}
			}
			allowed := map[string]bool{"theme": true, "codeWrap": true, "fontScale": true, "maxDepth": true, "maxFiles": true, "excludedDirectories": true, "markdownExtensions": true, "showHtmlComments": true}
			for key := range fields {
				if !allowed[key] {
					http.Error(w, "Request body contains unknown settings.", 400)
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
					http.Error(w, "Tag values must be strings.", 400)
					return
				}
			}
			if _, name := fields["name"]; !name {
				if _, color := fields["backgroundColor"]; !color {
					http.Error(w, "Tag name or background color is required.", 400)
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
		if operation == "ReplaceDocumentTags" {
			if value, ok := fields["tags"]; !ok || string(value) == "null" {
				http.Error(w, "Tags must be an array.", 400)
				return
			}
		}
		b, _ := json.Marshal(fields)
		if err := json.Unmarshal(b, &input); err != nil {
			http.Error(w, "Request body must be valid JSON.", 400)
			return
		}
		// Route parameters always take precedence over JSON input.
		if len(parts) >= 2 {
			n, _ := strconv.ParseInt(parts[1], 10, 64)
			if parts[0] == "documents" {
				input.DocumentID = session.ID(n)
			} else if parts[0] == "tags" {
				input.ID = session.ID(n)
			}
		}
		if len(parts) >= 4 && parts[2] == "comments" {
			n, _ := strconv.ParseInt(parts[3], 10, 64)
			input.CommentID = session.ID(n)
		}
	}
	if len(parts) >= 4 && parts[0] == "documents" {
		n, _ := strconv.ParseInt(parts[3], 10, 64)
		if parts[2] == "instructions" {
			input.InstructionID = session.ID(n)
		}
		if parts[2] == "memories" {
			input.MemoryID = session.ID(n)
		}
		if len(parts) == 6 && parts[2] == "comments" && parts[4] == "replies" {
			n, _ = strconv.ParseInt(parts[5], 10, 64)
			input.ReplyID = session.ID(n)
		}
	}
	result, err := r.session.Invoke(req.Context(), operation, input)
	if err != nil {
		respondError(w, err)
		return
	}
	if operation == "ListDocuments" {
		result = result.(map[string]any)["documents"]
	}
	if operation == "ListTags" || operation == "ReplaceDocumentTags" {
		result = result.(map[string]any)["tags"]
	}
	respond(w, status, result)
}
