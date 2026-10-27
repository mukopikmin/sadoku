package http_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"connectrpc.com/connect"
	pb "github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1"
	"github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1/previewv1connect"
	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/session"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

func restRequest(t *testing.T, serverURL, method, path, body, contentType string, status int) []byte {
	t.Helper()
	req, err := http.NewRequest(method, serverURL+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	b, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != status || res.Header.Get("Cache-Control") != "no-store" {
		t.Fatalf("%s %s: status %d, cache %q, body %s", method, path, res.StatusCode, res.Header.Get("Cache-Control"), b)
	}
	if status == http.StatusNoContent && len(b) != 0 {
		t.Fatalf("204 response has a body: %s", b)
	}
	if json.Valid(b) && !strings.HasPrefix(res.Header.Get("Content-Type"), "application/json") {
		t.Fatalf("JSON response has Content-Type %q", res.Header.Get("Content-Type"))
	}
	return b
}

func TestRESTDocumentsExposeOnlyPublicMetadata(t *testing.T) {
	s, server, _ := setup(t)
	id := s.Documents[0].ID
	tag, err := s.Repository.SaveTag(u.Tag{Name: "Review", BackgroundColor: "#123456"})
	if err != nil {
		t.Fatal(err)
	}
	if err = s.Repository.ReplaceTags(id, []int64{tag.ID}); err != nil {
		t.Fatal(err)
	}
	b := restRequest(t, server.URL, "GET", "/__sadoku/documents", "", "", 200)
	var documents []map[string]json.RawMessage
	if err = json.Unmarshal(b, &documents); err != nil || len(documents) != 1 {
		t.Fatalf("documents: %s %v", b, err)
	}
	if len(documents[0]) != 5 || documents[0]["filePath"] != nil {
		t.Fatalf("unexpected document fields: %s", b)
	}
	checkTags := func(b []byte) {
		t.Helper()
		var tags []map[string]json.RawMessage
		if err := json.Unmarshal(b, &tags); err != nil || len(tags) != 1 || len(tags[0]) != 3 || tags[0]["id"] == nil || tags[0]["name"] == nil || tags[0]["backgroundColor"] == nil {
			t.Fatalf("unexpected document tag fields: %s (%v)", b, err)
		}
	}
	checkTags(documents[0]["tags"])
	b = restRequest(t, server.URL, "GET", fmt.Sprintf("/__sadoku/documents/%d", id), "", "", 200)
	var document map[string]json.RawMessage
	if err = json.Unmarshal(b, &document); err != nil {
		t.Fatal(err)
	}
	checkTags(document["tags"])
}

func TestRESTDocumentIDsRejectNonCanonicalAndUnsafeNumbers(t *testing.T) {
	_, server, _ := setup(t)
	for _, id := range []string{"0", "-1", "+1", "01", "1.0", "abc", "9007199254740992", "18446744073709551616"} {
		t.Run(id, func(t *testing.T) {
			restRequest(t, server.URL, "GET", "/__sadoku/documents/"+id, "", "", 404)
		})
	}
}

func TestRESTSettingsRejectInvalidBodiesWithoutChangingStoredSettings(t *testing.T) {
	_, server, _ := setup(t)
	settings := config.Defaults()
	settings.Theme, settings.CodeWrap, settings.ShowHTMLComments = "dark", "wrap", false
	b, _ := json.Marshal(settings)
	restRequest(t, server.URL, "PUT", "/__sadoku/settings", string(b), "application/json", 200)
	var valid map[string]any
	if err := json.Unmarshal(b, &valid); err != nil {
		t.Fatal(err)
	}
	for key, value := range map[string]any{
		"theme": "sepia", "maxDepth": 2.5, "maxFiles": 0,
		"excludedDirectories": []string{"nested/vendor"}, "markdownExtensions": []string{".md", ".MD"},
		"fontScale": 0.74, "showHtmlComments": nil, "extra": true,
		"showHighlightBoundaries": "true",
	} {
		t.Run(key, func(t *testing.T) {
			invalid := make(map[string]any, len(valid))
			for k, v := range valid {
				invalid[k] = v
			}
			invalid[key] = value
			body, _ := json.Marshal(invalid)
			restRequest(t, server.URL, "PUT", "/__sadoku/settings", string(body), "application/json", 400)
			stored, _, err := config.Read()
			if err != nil || stored.Theme != "dark" || stored.MaxDepth != settings.MaxDepth || stored.ShowHTMLComments {
				t.Fatalf("invalid request changed settings: %+v %v", stored, err)
			}
		})
	}
	for _, body := range []string{"null", "[]", "{", string(b) + " {}"} {
		restRequest(t, server.URL, "PUT", "/__sadoku/settings", body, "application/json", 400)
	}
	restRequest(t, server.URL, "PUT", "/__sadoku/settings", string(b), "text/plain", 400)
	delete(valid, "showHtmlComments")
	b, _ = json.Marshal(valid)
	restRequest(t, server.URL, "PUT", "/__sadoku/settings", string(b), "application/json", 200)
	stored, _, err := config.Read()
	if err != nil || stored.ShowHTMLComments {
		t.Fatalf("older client reset HTML comment visibility: %+v %v", stored, err)
	}
}

func TestRESTTagConflictsAndPartialUpdates(t *testing.T) {
	s, server, _ := setup(t)
	one, err := s.Repository.SaveTag(u.Tag{Name: "One", BackgroundColor: "#123456"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Repository.SaveTag(u.Tag{Name: "Two", BackgroundColor: "#abcdef"}); err != nil {
		t.Fatal(err)
	}
	path := fmt.Sprintf("/__sadoku/tags/%d", one.ID)
	for _, body := range []string{`{}`, `null`, `{"name":null}`, `{"backgroundColor":"red"}`, `{"name":5}`} {
		restRequest(t, server.URL, "PATCH", path, body, "application/json", 400)
	}
	restRequest(t, server.URL, "PATCH", path, `{"name":"Two"}`, "application/json", 409)
	b := restRequest(t, server.URL, "PATCH", path, `{"backgroundColor":"#AABBCC"}`, "application/json", 200)
	var tag u.Tag
	if err = json.Unmarshal(b, &tag); err != nil || tag.Name != "One" || tag.BackgroundColor != "#aabbcc" {
		t.Fatalf("partial update: %s %v", b, err)
	}
	restRequest(t, server.URL, "DELETE", path, "", "", 204)
	restRequest(t, server.URL, "DELETE", path, "", "", 404)
}

func TestRESTGitHubExportReturnsStructuredFailures(t *testing.T) {
	s, server, _ := setup(t)
	id := s.Documents[0].ID
	path := fmt.Sprintf("/__sadoku/documents/%d/comments/1/github", id)
	sha := strings.Repeat("a", 40)
	body := `{"startLine":1,"endLine":1,"body":"Review","createdAt":"created","headSha":"` + sha + `","displayedMarkdown":"# Title\n\nBody\n"}`
	check := func(path, body, contentType string, status int, code string) {
		t.Helper()
		b := restRequest(t, server.URL, "POST", path, body, contentType, status)
		var failure struct{ Error struct{ Code string } }
		if err := json.Unmarshal(b, &failure); err != nil || failure.Error.Code != code {
			t.Fatalf("expected %s JSON error, got %s (%v)", code, b, err)
		}
	}
	check(path, `{}`, "text/plain", 404, "export_unavailable")
	s.Mu.Lock()
	s.GitHub = &session.Pull{HeadSHA: sha}
	s.Mu.Unlock()
	check("/__sadoku/documents/999/comments/1/github", body, "application/json", 404, "export_document_not_found")
	check(fmt.Sprintf("/__sadoku/documents/%d/comments/0/github", id), body, "application/json", 404, "export_comment_not_found")
	check(path, body, "text/plain", 415, "export_json_required")
	for _, invalid := range []string{`{`, `{}`, "null", strings.Replace(body, `"displayedMarkdown":"# Title\n\nBody\n"`, `"displayedMarkdown":null`, 1)} {
		check(path, invalid, "application/json", 400, "export_invalid_request")
	}
	check(path, strings.Replace(body, sha, strings.Repeat("b", 40), 1), "application/json", 409, "export_out_of_sync")
	check(path, strings.Replace(body, `# Title\n\nBody\n`, "changed", 1), "application/json", 409, "export_markdown_changed")
	check(path, body, "application/json", 404, "export_comment_not_found")
	s.Mu.Lock()
	s.ReadRemote = func(context.Context, string) (string, error) { return "", fmt.Errorf("remote unavailable") }
	s.Mu.Unlock()
	check(path, body, "application/json", 502, "export_failed")
}

func TestConnectGitHubExportPreservesErrorCodes(t *testing.T) {
	for _, jsonCodec := range []bool{true, false} {
		t.Run(fmt.Sprint(jsonCodec), func(t *testing.T) {
			s, server, _ := setup(t)
			options := []connect.ClientOption{}
			if jsonCodec {
				options = append(options, connect.WithProtoJSON())
			}
			client := previewv1connect.NewPreviewServiceClient(server.Client(), server.URL, options...)
			id := uint64(s.Documents[0].ID)
			check := func(in *pb.ExportCommentToGitHubRequest, code connect.Code, failure string) {
				t.Helper()
				_, err := client.ExportCommentToGitHub(context.Background(), connect.NewRequest(in))
				if connect.CodeOf(err) != code || !strings.Contains(err.Error(), `{"error":{"code":"`+failure+`"}}`) {
					t.Fatalf("expected %s / %s: %v", code, failure, err)
				}
			}
			check(&pb.ExportCommentToGitHubRequest{DocumentId: id}, connect.CodeNotFound, "export_unavailable")
			s.Mu.Lock()
			s.GitHub = &session.Pull{HeadSHA: strings.Repeat("a", 40)}
			s.Mu.Unlock()
			check(&pb.ExportCommentToGitHubRequest{DocumentId: 999}, connect.CodeNotFound, "export_document_not_found")
			check(&pb.ExportCommentToGitHubRequest{DocumentId: id}, connect.CodeInvalidArgument, "export_invalid_request")
			valid := &pb.ExportCommentToGitHubRequest{DocumentId: id, CommentId: 1, HeadSha: strings.Repeat("b", 40), StartLine: 1, EndLine: 1, CreatedAt: "created", Body: "Review", DisplayedMarkdown: "# Title\n\nBody\n"}
			check(valid, connect.CodeAlreadyExists, "export_out_of_sync")
			valid.HeadSha = strings.Repeat("a", 40)
			check(valid, connect.CodeNotFound, "export_comment_not_found")
			s.Mu.Lock()
			s.ReadRemote = func(context.Context, string) (string, error) { return "", fmt.Errorf("remote unavailable") }
			s.Mu.Unlock()
			check(valid, connect.CodeInternal, "export_failed")
		})
	}
}

func TestSettingsWriteFailureIsInternalAndPreservesTheFile(t *testing.T) {
	_, server, _ := setup(t)
	path := config.Path()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	const malformed = "theme_mode = ["
	if err := os.WriteFile(path, []byte(malformed), 0600); err != nil {
		t.Fatal(err)
	}
	settings := config.Defaults()
	settings.Theme, settings.CodeWrap = "dark", "wrap"
	body, _ := json.Marshal(settings)
	response := restRequest(t, server.URL, "PUT", "/__sadoku/settings", string(body), "application/json", 500)
	if string(response) != "Internal Server Error" {
		t.Fatalf("write failure: %s", response)
	}
	client := previewv1connect.NewPreviewServiceClient(server.Client(), server.URL, connect.WithProtoJSON())
	_, err := client.UpdateSettings(context.Background(), connect.NewRequest(&pb.UpdateSettingsRequest{Theme: "dark", CodeWrap: "wrap", FontScale: 1, MaxDepth: 2, MaxFiles: 20, ExcludedDirectories: settings.ExcludedDirectories, MarkdownExtensions: settings.MarkdownExtensions}))
	if connect.CodeOf(err) != connect.CodeInternal {
		t.Fatalf("RPC write failure: %v", err)
	}
	contents, err := os.ReadFile(path)
	if err != nil || string(contents) != malformed {
		t.Fatalf("invalid config was replaced: %q %v", contents, err)
	}
}
