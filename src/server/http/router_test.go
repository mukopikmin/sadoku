package http_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"
	pb "github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1"
	"github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1/previewv1connect"
	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	httpadapter "github.com/mukopikmin/sadoku/src/server/http"
	"github.com/mukopikmin/sadoku/src/server/session"
	"github.com/mukopikmin/sadoku/src/server/storage"
)

func setup(t *testing.T) (*session.Session, *httptest.Server, string) {
	t.Helper()
	directory := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(directory, "config"))
	t.Setenv("APPDATA", "")
	t.Setenv("SADOKU_COMMENTS_DIR", filepath.Join(directory, "comments"))
	docs := filepath.Join(directory, "docs")
	if err := os.Mkdir(docs, 0700); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(docs, "readme.md")
	if err := os.WriteFile(file, []byte("# Title\n\nBody\n"), 0600); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(directory, "comments", "sadoku.sqlite3")
	database, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { database.Close() })
	repo := &storage.Repository{DB: database, Path: path}
	s, err := session.New(context.Background(), docs, repo, config.Defaults())
	if err != nil {
		t.Fatal(err)
	}
	handler, err := httpadapter.New(s, httpadapter.Options{TrustForwardedPrefix: true})
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return s, server, file
}
func TestConnectWorkflow(t *testing.T) {
	for _, jsonCodec := range []bool{true, false} {
		t.Run(map[bool]string{true: "JSON", false: "Protobuf"}[jsonCodec], func(t *testing.T) {
			_, server, file := setup(t)
			options := []connect.ClientOption{}
			if jsonCodec {
				options = append(options, connect.WithProtoJSON())
			}
			client := previewv1connect.NewPreviewServiceClient(server.Client(), server.URL, options...)
			ctx := context.Background()
			info, err := client.GetSession(ctx, connect.NewRequest(&pb.GetSessionRequest{}))
			if err != nil || !info.Msg.CanCreateDocuments {
				t.Fatalf("session: %v %v", info, err)
			}
			list, err := client.ListDocuments(ctx, connect.NewRequest(&pb.ListDocumentsRequest{}))
			if err != nil || len(list.Msg.Documents) != 1 {
				t.Fatalf("list %v %v", list, err)
			}
			id := list.Msg.Documents[0].Id
			_, err = client.UpdateTag(ctx, connect.NewRequest(&pb.UpdateTagRequest{Name: "invalid", BackgroundColor: "#abcdef"}))
			if connect.CodeOf(err) != connect.CodeInvalidArgument {
				t.Fatalf("zero-ID update created a tag: %v", err)
			}
			_, err = client.UpdateInstruction(ctx, connect.NewRequest(&pb.UpdateInstructionRequest{DocumentId: id, Content: "invalid"}))
			if connect.CodeOf(err) != connect.CodeNotFound {
				t.Fatalf("zero-ID update created an instruction: %v", err)
			}
			created, err := client.CreateComment(ctx, connect.NewRequest(&pb.CreateCommentRequest{DocumentId: id, StartLine: 3, EndLine: 3, Body: "Review"}))
			if err != nil || created.Msg.Body != "Review" {
				t.Fatalf("create %v %v", created, err)
			}
			if created.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("missing cache policy")
			}
			commentID := created.Msg.Id
			reply, err := client.CreateReply(ctx, connect.NewRequest(&pb.CreateReplyRequest{DocumentId: id, CommentId: commentID, Body: "Reply"}))
			if err != nil || len(reply.Msg.Replies) != 1 {
				t.Fatalf("reply %v %v", reply, err)
			}
			resolved, err := client.SetCommentResolution(ctx, connect.NewRequest(&pb.SetCommentResolutionRequest{DocumentId: id, CommentId: commentID, Resolved: true}))
			if err != nil || !resolved.Msg.Resolved || resolved.Msg.ResolvedBy.Type != "human" {
				t.Fatalf("resolve %v %v", resolved, err)
			}
			if err = os.WriteFile(file, []byte("# Title\n\nAdded\nBody edited\n"), 0600); err != nil {
				t.Fatal(err)
			}
			comments, err := client.ListComments(ctx, connect.NewRequest(&pb.ListCommentsRequest{DocumentId: id}))
			if err != nil || len(comments.Msg.Comments) != 1 || comments.Msg.Comments[0].Stale {
				t.Fatalf("comments %v %v", comments, err)
			}
			revisions, err := client.ListDocumentRevisions(ctx, connect.NewRequest(&pb.ListDocumentRevisionsRequest{DocumentId: id}))
			if err != nil || len(revisions.Msg.Revisions) != 2 {
				t.Fatalf("revisions %v %v", revisions, err)
			}
			oldID := revisions.Msg.Revisions[1].Id
			old, err := client.GetDocumentRevision(ctx, connect.NewRequest(&pb.GetDocumentRevisionRequest{DocumentId: id, RevisionId: oldID}))
			if err != nil || old.Msg.Markdown != "# Title\n\nBody\n" {
				t.Fatalf("revision %v %v", old, err)
			}
			wrong := "wrong"
			_, err = client.RestoreDocumentRevision(ctx, connect.NewRequest(&pb.RestoreDocumentRevisionRequest{DocumentId: id, RevisionId: oldID, ExpectedMarkdown: &wrong}))
			if connect.CodeOf(err) != connect.CodeAborted {
				t.Fatalf("restore conflict %v", err)
			}
			current := "# Title\n\nAdded\nBody edited\n"
			_, err = client.RestoreDocumentRevision(ctx, connect.NewRequest(&pb.RestoreDocumentRevisionRequest{DocumentId: id, RevisionId: oldID, ExpectedMarkdown: &current}))
			if err != nil {
				t.Fatal(err)
			}
			b, _ := os.ReadFile(file)
			if string(b) != old.Msg.Markdown {
				t.Fatal("restore failed")
			}
			tags, err := client.ReplaceDocumentTags(ctx, connect.NewRequest(&pb.ReplaceDocumentTagsRequest{DocumentId: id, Tags: []*pb.TagReference{{Reference: &pb.TagReference_Name{Name: "Review"}}}}))
			if err != nil || len(tags.Msg.Tags) != 1 {
				t.Fatalf("tags %v %v", tags, err)
			}
			_, err = client.UpdateTag(ctx, connect.NewRequest(&pb.UpdateTagRequest{Id: tags.Msg.Tags[0].Id, Name: "Done", BackgroundColor: "#abcdef"}))
			if err != nil {
				t.Fatal(err)
			}
			note, err := client.CreateInstruction(ctx, connect.NewRequest(&pb.CreateInstructionRequest{DocumentId: id, Content: "Check wording"}))
			if err != nil || note.Msg.Content != "Check wording" {
				t.Fatalf("instruction %v %v", note, err)
			}
			_, err = client.UpdateInstruction(ctx, connect.NewRequest(&pb.UpdateInstructionRequest{DocumentId: id, InstructionId: note.Msg.Id, Content: "Updated"}))
			if err != nil {
				t.Fatal(err)
			}
			_, err = client.DeleteInstruction(ctx, connect.NewRequest(&pb.DeleteInstructionRequest{DocumentId: id, InstructionId: note.Msg.Id}))
			if err != nil {
				t.Fatal(err)
			}
			_, err = client.UpdateSettings(ctx, connect.NewRequest(&pb.UpdateSettingsRequest{Theme: "dark", CodeWrap: "wrap", FontScale: 1.1, MaxDepth: 3, MaxFiles: 30, ExcludedDirectories: []string{".git"}, MarkdownExtensions: []string{".md"}}))
			if err != nil {
				t.Fatal(err)
			}
			settings, err := client.GetSettings(ctx, connect.NewRequest(&pb.GetSettingsRequest{}))
			if err != nil || settings.Msg.GetTheme() != "dark" || settings.Msg.FontScale != 1.1 {
				t.Fatalf("settings %v %v", settings, err)
			}
			newDoc, err := client.CreateDocument(ctx, connect.NewRequest(&pb.CreateDocumentRequest{Filename: "new", Title: "Custom"}))
			if err != nil || newDoc.Msg.RelativePath != "new.md" || newDoc.Msg.GetDisplayTitle() != "Custom" {
				t.Fatalf("new doc %v %v", newDoc, err)
			}
			_, err = client.GetDocument(ctx, connect.NewRequest(&pb.GetDocumentRequest{DocumentId: ^uint64(0)}))
			if connect.CodeOf(err) != connect.CodeInvalidArgument && connect.CodeOf(err) != connect.CodeNotFound {
				t.Fatalf("overflow %v", err)
			}
			_, err = client.DeleteReply(ctx, connect.NewRequest(&pb.DeleteReplyRequest{DocumentId: id, CommentId: commentID, ReplyId: reply.Msg.Replies[0].Id}))
			if err != nil {
				t.Fatal(err)
			}
			_, err = client.DeleteComment(ctx, connect.NewRequest(&pb.DeleteCommentRequest{DocumentId: id, CommentId: commentID}))
			if err != nil {
				t.Fatal(err)
			}
		})
	}
}
func TestHTTPAssetsValidationAndSSE(t *testing.T) {
	_, server, file := setup(t)
	request := func(method, path, body string) *http.Response {
		t.Helper()
		req, _ := http.NewRequest(method, server.URL+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Connect-Protocol-Version", "1")
		res, err := server.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { res.Body.Close() })
		return res
	}
	res := request("GET", "/documents/1", "")
	b, _ := io.ReadAll(res.Body)
	if res.StatusCode != 200 || !bytes.Contains(b, []byte("sadoku-client-root")) {
		t.Fatal("SPA unavailable")
	}
	res = request("GET", "/assets/.vite/manifest.json", "")
	var manifest map[string]struct{ File string }
	if err := json.NewDecoder(res.Body).Decode(&manifest); err != nil {
		t.Fatal(err)
	}
	res = request("GET", "/assets/"+manifest["main.tsx"].File, "")
	if res.StatusCode != 200 || !strings.Contains(res.Header.Get("Cache-Control"), "immutable") {
		t.Fatal("fingerprinted asset unavailable")
	}
	res = request("GET", "/assets/%2e%2e%2fgo.mod", "")
	if res.StatusCode != 404 {
		t.Fatalf("traversal %d", res.StatusCode)
	}
	req, _ := http.NewRequest("GET", server.URL+"/", nil)
	req.Header.Set("X-Forwarded-Prefix", "/x\"bad")
	res, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 400 {
		t.Fatal("unsafe prefix accepted")
	}
	res = request("POST", "/sadoku.preview.v1.PreviewService/CreateComment", `{"documentId":"1","startLine":0,"endLine":0,"body":"bad"}`)
	if res.StatusCode != 400 {
		t.Fatalf("invalid range %d", res.StatusCode)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	req, _ = http.NewRequestWithContext(ctx, "GET", server.URL+"/__sadoku/documents/1/events", nil)
	res, err = server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	time.Sleep(500 * time.Millisecond)
	if err = os.WriteFile(file, []byte("updated\n"), 0600); err != nil {
		t.Fatal(err)
	}
	buffer := make([]byte, 1024)
	n, err := res.Body.Read(buffer)
	if err != nil || !bytes.Contains(buffer[:n], []byte("event: invalidate")) {
		t.Fatalf("SSE %s %v", buffer[:n], err)
	}
}
