package integration_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"
	pb "github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1"
	"github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1/previewv1connect"
	"github.com/mukopikmin/sadoku/src/server"
	"github.com/mukopikmin/sadoku/src/server/cli"
	"github.com/ncruces/go-sqlite3"
)

type readyOutput struct{ ready chan string }

func (output readyOutput) Write(data []byte) (int, error) {
	for _, line := range strings.Split(string(data), "\n") {
		if _, message, ok := strings.Cut(line, "] "); ok {
			line = message
		}
		if strings.HasPrefix(line, "Preview: ") {
			select {
			case output.ready <- strings.TrimPrefix(line, "Preview: "):
			default:
			}
		}
	}
	return len(data), nil
}

func startServer(t *testing.T, source string, port int, keepAlive bool) (string, <-chan struct{}) {
	t.Helper()
	// Readiness timing excludes the one-time SQLite Wasm compilation.
	if err := sqlite3.Initialize(); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	t.Setenv("SADOKU_COMMENTS_DIR", filepath.Join(root, "comments"))
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(root, "config"))
	t.Setenv("APPDATA", "")
	ctx, cancel := context.WithCancel(context.Background())
	output := readyOutput{ready: make(chan string, 1)}
	stopped := make(chan struct{})
	var serveErr error
	go func() {
		defer close(stopped)
		serveErr = server.Start(ctx, cli.StartOptions{Source: source, Host: "127.0.0.1", Port: port, KeepAlive: keepAlive}, output)
	}()
	t.Cleanup(func() {
		cancel()
		select {
		case <-stopped:
			if serveErr != nil {
				t.Errorf("server shutdown: %v", serveErr)
			}
		case <-time.After(10 * time.Second):
			t.Error("server did not stop")
		}
	})
	select {
	case previewURL := <-output.ready:
		parsed, err := url.Parse(previewURL)
		if err != nil {
			t.Fatal(err)
		}
		parsed.Path = ""
		base := parsed.String()
		if info, err := os.Stat(source); err == nil && info.IsDir() {
			client := previewv1connect.NewPreviewServiceClient(&http.Client{Timeout: 3 * time.Second}, base, connect.WithProtoJSON())
			deadline := time.Now().Add(10 * time.Second)
			for {
				status, err := client.GetDirectoryStatus(context.Background(), connect.NewRequest(&pb.GetDirectoryStatusRequest{}))
				if err != nil {
					t.Fatal(err)
				}
				if status.Msg.State == "ready" {
					break
				}
				if status.Msg.State == "error" || time.Now().After(deadline) {
					t.Fatalf("directory preparation: %+v", status.Msg)
				}
				time.Sleep(5 * time.Millisecond)
			}
		}
		return base, stopped
	case <-stopped:
		t.Fatalf("server startup: %v", serveErr)
	case <-time.After(10 * time.Second):
		t.Fatal("server did not start")
	}
	return "", stopped
}

func markdownFile(t *testing.T, name, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, []byte(body), 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestServerFallsBackFromOccupiedPortAndStopsCleanly(t *testing.T) {
	reserved, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer reserved.Close()
	port := reserved.Addr().(*net.TCPAddr).Port
	if port == 65535 {
		t.Skip("cannot increment final TCP port")
	}
	previewURL, _ := startServer(t, markdownFile(t, "preview.md", "# Preview\n"), port, true)
	parsed, err := url.Parse(previewURL)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Port() == fmt.Sprint(port) {
		t.Fatal("reused an occupied port")
	}
	client := &http.Client{Timeout: 5 * time.Second}
	response, err := client.Get(previewURL)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil || response.StatusCode != 200 || !strings.Contains(string(body), "sadoku-client-root") || response.Header.Get("Cache-Control") != "no-store" {
		t.Fatalf("preview response: %d %v", response.StatusCode, err)
	}
}

func TestLastEventStreamDisconnectShutsDownServer(t *testing.T) {
	previewURL, stopped := startServer(t, markdownFile(t, "preview.md", "# Preview\n"), 0, false)
	response, err := http.Get(previewURL + "/__sadoku/events")
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != 200 {
		response.Body.Close()
		t.Fatalf("events status %d", response.StatusCode)
	}
	response.Body.Close()
	select {
	case <-stopped:
	case <-time.After(8 * time.Second):
		t.Fatal("server kept running after the last tab disconnected")
	}
}

func TestRemoteSourceKeepsFetchTokenOutOfPersistentIdentity(t *testing.T) {
	requests := make(chan string, 4)
	remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests <- r.URL.RawQuery
		fmt.Fprint(w, "# Remote\nBody\n")
	}))
	defer remote.Close()
	previewURL, _ := startServer(t, remote.URL+"/guide.md?token=private#heading", 0, true)
	select {
	case query := <-requests:
		if query != "token=private" {
			t.Fatalf("fetch lost token: %s", query)
		}
	case <-time.After(time.Second):
		t.Fatal("source was not fetched")
	}
	client := previewv1connect.NewPreviewServiceClient(http.DefaultClient, previewURL, connect.WithProtoJSON())
	documents, err := client.ListDocuments(context.Background(), connect.NewRequest(&pb.ListDocumentsRequest{}))
	if err != nil || len(documents.Msg.Documents) != 1 {
		t.Fatalf("documents: %v %v", documents, err)
	}
	id := documents.Msg.Documents[0].Id
	_, err = client.CreateComment(context.Background(), connect.NewRequest(&pb.CreateCommentRequest{DocumentId: id, StartLine: 2, EndLine: 2, Body: "review"}))
	if err != nil {
		t.Fatal(err)
	}
	comments, err := client.ListComments(context.Background(), connect.NewRequest(&pb.ListCommentsRequest{DocumentId: id}))
	if err != nil {
		t.Fatal(err)
	}
	if comments.Msg.FilePath != remote.URL+"/guide.md" || len(comments.Msg.Comments) != 1 {
		t.Fatalf("persistent identity exposed fetch URL: %+v", comments.Msg)
	}
}

func TestDeletedDocumentRestoresItsSavedRevision(t *testing.T) {
	file := markdownFile(t, "restore.md", "# Original\nBody\n")
	previewURL, _ := startServer(t, filepath.Dir(file), 0, true)
	client := previewv1connect.NewPreviewServiceClient(http.DefaultClient, previewURL, connect.WithProtoJSON())
	ctx := context.Background()
	documents, err := client.ListDocuments(ctx, connect.NewRequest(&pb.ListDocumentsRequest{}))
	if err != nil {
		t.Fatal(err)
	}
	id := documents.Msg.Documents[0].Id
	// Displaying a live document initializes its archive even when the
	// background snapshot queue has not reached it yet.
	if _, err = client.GetDocument(ctx, connect.NewRequest(&pb.GetDocumentRequest{DocumentId: id})); err != nil {
		t.Fatal(err)
	}
	history, err := client.ListDocumentRevisions(ctx, connect.NewRequest(&pb.ListDocumentRevisionsRequest{DocumentId: id}))
	if err != nil || len(history.Msg.Revisions) != 1 {
		t.Fatalf("history %v %v", history, err)
	}
	if err = os.Remove(file); err != nil {
		t.Fatal(err)
	}
	doc, err := client.GetDocument(ctx, connect.NewRequest(&pb.GetDocumentRequest{DocumentId: id}))
	if err != nil || !doc.Msg.Deleted || !doc.Msg.CanRestore || doc.Msg.Markdown != "# Original\nBody\n" {
		t.Fatalf("deleted document %+v %v", doc, err)
	}
	_, err = client.RestoreDocumentRevision(ctx, connect.NewRequest(&pb.RestoreDocumentRevisionRequest{DocumentId: id, RevisionId: history.Msg.Revisions[0].Id}))
	if err != nil {
		t.Fatal(err)
	}
	contents, err := os.ReadFile(file)
	if err != nil || string(contents) != "# Original\nBody\n" {
		t.Fatal("file was not recreated", err)
	}
	doc, err = client.GetDocument(ctx, connect.NewRequest(&pb.GetDocumentRequest{DocumentId: id}))
	if err != nil || doc.Msg.Deleted {
		t.Fatal("restored document remained deleted", err)
	}
}

func TestRESTCommentsRemainScopedAndValidateBodies(t *testing.T) {
	file := markdownFile(t, "one.md", "# One\nBody\n")
	if err := os.WriteFile(filepath.Join(filepath.Dir(file), "two.md"), []byte("# Two\nBody\n"), 0600); err != nil {
		t.Fatal(err)
	}
	previewURL, _ := startServer(t, filepath.Dir(file), 0, true)
	httpClient := &http.Client{Timeout: 5 * time.Second}
	request := func(method, path, body string) *http.Response {
		t.Helper()
		req, _ := http.NewRequest(method, previewURL+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res, err := httpClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { res.Body.Close() })
		return res
	}
	response := request("GET", "/__sadoku/documents", "")
	var documents []struct{ ID int64 }
	if err := json.NewDecoder(response.Body).Decode(&documents); err != nil || len(documents) != 2 {
		t.Fatalf("document list: %v %v", documents, err)
	}
	one, two := documents[0].ID, documents[1].ID
	path := fmt.Sprintf("/__sadoku/documents/%d/comments", one)
	response = request("POST", path, `{"startLine":2,"endLine":2,"body":"review"}`)
	if response.StatusCode != 201 {
		t.Fatalf("comment creation: %d", response.StatusCode)
	}
	response = request("GET", fmt.Sprintf("/__sadoku/documents/%d/comments", two), "")
	var comments struct{ Comments []json.RawMessage }
	if err := json.NewDecoder(response.Body).Decode(&comments); err != nil || len(comments.Comments) != 0 {
		t.Fatal("comments crossed document boundary", err)
	}
	response = request("POST", path, `{"startLine":1,"endLine":1,"body":"x"} {}`)
	if response.StatusCode != 400 {
		t.Fatal("accepted trailing JSON")
	}
	response = request("DELETE", fmt.Sprintf("%s/1", path), "")
	if response.StatusCode != 204 {
		t.Fatalf("delete status: %d", response.StatusCode)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil || len(body) != 0 {
		t.Fatal("delete returned a response body", err)
	}
}
