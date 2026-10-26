package session

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	"github.com/mukopikmin/sadoku/src/server/storage"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

// Run the real gh subprocess boundary with deterministic, local responses.
func TestGitHubFixtureProcess(t *testing.T) {
	if os.Getenv("SADOKU_GH_FIXTURE_PROCESS") != "1" {
		return
	}
	directory := os.Getenv("SADOKU_GH_FIXTURE_DIRECTORY")
	endpoint := os.Args[len(os.Args)-1]
	call := struct {
		Endpoint  string
		Query     string
		Variables map[string]any
	}{Endpoint: endpoint}
	if endpoint == "graphql" {
		b, _ := io.ReadAll(os.Stdin)
		if json.Unmarshal(b, &call) != nil {
			os.Exit(2)
		}
	}
	log, err := os.OpenFile(filepath.Join(directory, "calls.jsonl"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		os.Exit(2)
	}
	json.NewEncoder(log).Encode(call)
	log.Close()
	b, err := os.ReadFile(filepath.Join(directory, "responses.json"))
	var responses map[string]json.RawMessage
	if err != nil || json.Unmarshal(b, &responses) != nil {
		os.Exit(2)
	}
	key := endpoint
	if endpoint == "graphql" {
		for _, operation := range []string{"updatePullRequestReviewComment(", "addPullRequestReviewThread(", "addPullRequestReview(", "on PullRequestReviewComment", "on PullRequestReview{"} {
			if strings.Contains(call.Query, operation) {
				key = operation
				break
			}
		}
	}
	response, ok := responses[key]
	if !ok {
		fmt.Fprintln(os.Stderr, "unexpected GitHub request:", key)
		os.Exit(2)
	}
	os.Stdout.Write(response)
	os.Exit(0)
}

type githubFixture struct {
	s                           *Session
	in                          Input
	responses                   map[string]any
	directory, endpoint, marker string
}

func newGitHubFixture(t *testing.T) *githubFixture {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("fake gh launcher uses a POSIX shell")
	}
	root := t.TempDir()
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	quote := func(s string) string { return "'" + strings.ReplaceAll(s, "'", "'\"'\"'") + "'" }
	launcher := "#!/bin/sh\nGORACE=atexit_sleep_ms=0 SADOKU_GH_FIXTURE_PROCESS=1 exec " + quote(executable) + " -test.run=^TestGitHubFixtureProcess$ -- \"$@\"\n"
	if err := os.WriteFile(filepath.Join(root, "gh"), []byte(launcher), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", root+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("SADOKU_GH_FIXTURE_DIRECTORY", root)
	path := filepath.Join(root, "db.sqlite3")
	database, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { database.Close() })
	repo := &storage.Repository{DB: database, Path: path}
	f := &githubFixture{directory: root, endpoint: "repos/owner/repo/pulls/1"}
	sha := strings.Repeat("a", 40)
	pullURL := "https://github.com/owner/repo/pull/1"
	f.in = Input{CommentID: 1, HeadSHA: sha, DisplayedMarkdown: "Title\nBody\n", CreatedAt: "2026-10-25T00:00:00.000Z", Body: "Review", StartLine: 2, EndLine: 2}
	key, _ := json.Marshal([]any{pullURL, "readme.md", 1, f.in.CreatedAt})
	f.marker = fmt.Sprintf("<!-- sadoku-comment:%x -->", sha256.Sum256(key))
	f.responses = map[string]any{
		f.endpoint: map[string]any{"node_id": "pull1", "title": "Example", "body": "Details", "state": "open", "head": map[string]any{"sha": sha}},
		f.endpoint + "/files?per_page=100&page=1": []any{map[string]any{"filename": "readme.md", "status": "modified", "patch": "@@ -1,2 +1,2 @@\n Title\n+Body"}},
		"user": map[string]any{"login": "viewer"},
		f.endpoint + "/reviews?per_page=100&page=1":  []any{},
		f.endpoint + "/comments?per_page=100&page=1": []any{},
		"addPullRequestReview(":                      map[string]any{"data": map[string]any{"addPullRequestReview": map[string]any{"pullRequestReview": map[string]any{"id": "review1", "state": "PENDING"}}}},
		"addPullRequestReviewThread(":                map[string]any{"data": map[string]any{"addPullRequestReviewThread": map[string]any{"thread": map[string]any{"id": "thread1"}}}},
		"updatePullRequestReviewComment(":            map[string]any{"data": map[string]any{"updatePullRequestReviewComment": map[string]any{"pullRequestReviewComment": map[string]any{"id": "comment1"}}}},
		"on PullRequestReview{":                      map[string]any{"data": map[string]any{"node": map[string]any{"state": "PENDING", "commit": map[string]any{"oid": sha}, "author": map[string]any{"login": "viewer"}}}},
	}
	f.write(t)
	f.s, err = New(context.Background(), pullURL, repo, config.Defaults())
	if err != nil {
		t.Fatal(err)
	}
	f.s.ReadRemote = func(context.Context, string) (string, error) { return f.in.DisplayedMarkdown, nil }
	f.in.DocumentID = ID(f.s.Documents[0].ID)
	comments, _, err := u.ChangeComment("CreateComment", u.Comments{Comments: []u.Comment{}}, u.CommentInput{StartLine: 2, EndLine: 2, Body: "Review"}, f.in.DisplayedMarkdown, f.in.CreatedAt)
	if err != nil {
		t.Fatal(err)
	}
	if err = f.s.saveComments(int64(f.in.DocumentID), comments); err != nil {
		t.Fatal(err)
	}
	return f
}

func (f *githubFixture) write(t *testing.T) {
	t.Helper()
	b, err := json.Marshal(f.responses)
	if err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(filepath.Join(f.directory, "responses.json"), b, 0600); err != nil {
		t.Fatal(err)
	}
}

func (f *githubFixture) pending(t *testing.T, body string) {
	t.Helper()
	f.responses[f.endpoint+"/reviews?per_page=100&page=1"] = []any{map[string]any{"id": 7, "node_id": "review1", "state": "PENDING", "commit_id": f.in.HeadSHA, "user": map[string]any{"login": "viewer"}}}
	comments := []any{}
	if body != "" {
		comments = append(comments, f.remoteComment("viewer", body))
	}
	f.responses[f.endpoint+"/reviews/7/comments?per_page=100&page=1"] = comments
	f.responses["on PullRequestReviewComment"] = map[string]any{"data": map[string]any{"node": map[string]any{"body": body, "pullRequestReview": map[string]any{"id": "review1", "state": "PENDING", "author": map[string]any{"login": "viewer"}, "commit": map[string]any{"oid": f.in.HeadSHA}}}}}
}

func (f *githubFixture) remoteComment(login, body string) map[string]any {
	return map[string]any{"node_id": "comment1", "body": body, "html_url": f.s.GitHub.URL + "#discussion_r17", "user": map[string]any{"login": login}, "pull_request_review_id": 7, "commit_id": f.in.HeadSHA, "path": "readme.md", "line": 2, "side": "RIGHT"}
}

func (f *githubFixture) mutations(t *testing.T) []map[string]any {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(f.directory, "calls.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	calls := []map[string]any{}
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		var call map[string]any
		if err = json.Unmarshal([]byte(line), &call); err != nil {
			t.Fatal(err)
		}
		if query, _ := call["Query"].(string); strings.HasPrefix(query, "mutation") {
			calls = append(calls, call)
		}
	}
	return calls
}

func TestGitHubExportReusesPendingReviewsAndSurvivesRestart(t *testing.T) {
	f := newGitHubFixture(t)
	result, err := f.s.Invoke(context.Background(), "ExportCommentToGitHub", f.in)
	if err != nil || result.(map[string]any)["state"] != "pending" {
		t.Fatalf("create: %v %v", result, err)
	}
	f.pending(t, "Earlier body\n\n"+f.marker)
	f.write(t)
	restarted, err := New(context.Background(), f.s.GitHub.URL, f.s.Repository, config.Defaults())
	if err != nil {
		t.Fatal(err)
	}
	restarted.ReadRemote = f.s.ReadRemote
	if _, err = restarted.Invoke(context.Background(), "ExportCommentToGitHub", f.in); err != nil {
		t.Fatal("update after restart:", err)
	}
	f.pending(t, f.in.Body+"\n\n"+f.marker)
	f.write(t)
	if _, err = restarted.Invoke(context.Background(), "ExportCommentToGitHub", f.in); err != nil {
		t.Fatal("idempotent export:", err)
	}
	calls := f.mutations(t)
	if len(calls) != 2 || !strings.Contains(calls[1]["Query"].(string), "updatePullRequestReviewComment(") {
		t.Fatalf("duplicate or wrong mutation: %v", calls)
	}
	for _, call := range calls {
		variables := call["Variables"].(map[string]any)
		if strings.Contains(call["Query"].(string), "event:") || variables["body"] != f.in.Body+"\n\n"+f.marker || variables["startLine"] != nil {
			t.Fatalf("submitted review, unstable marker, or unnecessary range: %v", call)
		}
	}
}

func TestGitHubExportFindsViewerSubmittedCommentAfterOtherReviewers(t *testing.T) {
	for _, pending := range []bool{false, true} {
		t.Run(fmt.Sprint(pending), func(t *testing.T) {
			f := newGitHubFixture(t)
			if pending {
				f.pending(t, "")
			}
			other := f.remoteComment("other", "Review\n\n"+f.marker)
			viewer := f.remoteComment("viewer", "Review\n\n"+f.marker)
			viewer["pull_request_review_id"] = 8
			f.responses[f.endpoint+"/comments?per_page=100&page=1"] = []any{other, viewer}
			f.write(t)
			result, err := f.s.Invoke(context.Background(), "ExportCommentToGitHub", f.in)
			if err != nil || result.(map[string]any)["state"] != "submitted" || len(f.mutations(t)) != 0 {
				t.Fatalf("submitted export: %v %v", result, err)
			}
		})
	}
}

func TestGitHubExportFailsClosedBeforeMutations(t *testing.T) {
	for _, scenario := range []string{"submitted review", "changed owner", "changed head", "changed body", "null reviews", "missing viewer", "missing review node", "unsafe comment URL", "missing comment node", "GraphQL errors"} {
		t.Run(scenario, func(t *testing.T) {
			f := newGitHubFixture(t)
			f.pending(t, "Earlier body\n\n"+f.marker)
			node := f.responses["on PullRequestReviewComment"].(map[string]any)["data"].(map[string]any)["node"].(map[string]any)
			review := node["pullRequestReview"].(map[string]any)
			switch scenario {
			case "submitted review":
				review["state"] = "COMMENTED"
			case "changed owner":
				review["author"] = map[string]any{"login": "other"}
			case "changed head":
				review["commit"] = map[string]any{"oid": strings.Repeat("b", 40)}
			case "changed body":
				node["body"] = "Externally edited"
			case "null reviews":
				f.responses[f.endpoint+"/reviews?per_page=100&page=1"] = nil
			case "missing viewer":
				f.responses["user"] = map[string]any{}
			case "missing review node":
				f.responses[f.endpoint+"/reviews?per_page=100&page=1"].([]any)[0].(map[string]any)["node_id"] = ""
			case "unsafe comment URL", "missing comment node":
				f.responses[f.endpoint+"/reviews?per_page=100&page=1"] = []any{}
				comment := f.remoteComment("viewer", "Review\n\n"+f.marker)
				if scenario == "unsafe comment URL" {
					comment["html_url"] = "https://example.com/comment"
				} else {
					delete(comment, "node_id")
				}
				f.responses[f.endpoint+"/comments?per_page=100&page=1"] = []any{comment}
			case "GraphQL errors":
				f.responses["on PullRequestReviewComment"].(map[string]any)["errors"] = []any{map[string]any{"message": "failed"}}
			}
			f.write(t)
			if _, err := f.s.Invoke(context.Background(), "ExportCommentToGitHub", f.in); err == nil {
				t.Fatal("export accepted changed or malformed remote state")
			}
			if calls := f.mutations(t); len(calls) != 0 {
				t.Fatalf("mutated before rejecting unsafe state: %v", calls)
			}
		})
	}
}

func TestGitHubExportPaginatesAndAddsToTheViewerReview(t *testing.T) {
	f := newGitHubFixture(t)
	f.pending(t, "")
	viewer := f.responses[f.endpoint+"/reviews?per_page=100&page=1"]
	others := make([]any, 100)
	replies := make([]any, 100)
	for i := range others {
		others[i] = map[string]any{"id": 100 + i, "state": "PENDING", "user": map[string]any{"login": "other"}}
		reply := f.remoteComment("viewer", "Review\n\n"+f.marker)
		reply["in_reply_to_id"] = i + 1
		replies[i] = reply
	}
	f.responses[f.endpoint+"/reviews?per_page=100&page=1"] = others
	f.responses[f.endpoint+"/reviews?per_page=100&page=2"] = viewer
	f.responses[f.endpoint+"/reviews/7/comments?per_page=100&page=1"] = replies
	f.responses[f.endpoint+"/reviews/7/comments?per_page=100&page=2"] = []any{}
	f.write(t)
	if _, err := f.s.Invoke(context.Background(), "ExportCommentToGitHub", f.in); err != nil {
		t.Fatal(err)
	}
	calls := f.mutations(t)
	if len(calls) != 1 || !strings.Contains(calls[0]["Query"].(string), "addPullRequestReviewThread(") || calls[0]["Variables"].(map[string]any)["reviewId"] != "review1" {
		t.Fatalf("wrong pending review: %v", calls)
	}
}

func TestGitHubExportDiffEligibilityAndMutationFailures(t *testing.T) {
	for _, scenario := range []string{"removed file", "missing patch", "split hunks", "multiline hunk", "mutation error"} {
		t.Run(scenario, func(t *testing.T) {
			f := newGitHubFixture(t)
			file := f.responses[f.endpoint+"/files?per_page=100&page=1"].([]any)[0].(map[string]any)
			switch scenario {
			case "removed file":
				file["status"] = "removed"
			case "missing patch":
				delete(file, "patch")
			case "split hunks", "multiline hunk":
				f.in.StartLine = 1
				comments, err := f.s.Repository.ReadComments(f.s.CommentDocumentID(int64(f.in.DocumentID)))
				if err != nil {
					t.Fatal(err)
				}
				comments.Comments[0].StartLine = 1
				if err := f.s.Repository.SaveComments(f.s.CommentDocumentID(int64(f.in.DocumentID)), comments); err != nil {
					t.Fatal(err)
				}
				if scenario == "split hunks" {
					file["patch"] = "@@ -1 +1 @@\n+Title\n@@ -2 +2 @@\n+Body"
				}
			case "mutation error":
				f.responses["addPullRequestReview("].(map[string]any)["errors"] = []any{map[string]any{"message": "failed despite data"}}
			}
			f.write(t)
			_, err := f.s.Invoke(context.Background(), "ExportCommentToGitHub", f.in)
			calls := f.mutations(t)
			if scenario == "multiline hunk" {
				if err != nil || len(calls) != 1 || calls[0]["Variables"].(map[string]any)["startLine"] != float64(1) {
					t.Fatalf("multiline export: %v %v", calls, err)
				}
			} else if err == nil {
				t.Fatal("accepted failed export")
			} else if scenario == "mutation error" {
				if len(calls) != 1 {
					t.Fatalf("mutation was retried: %v", calls)
				}
			} else if len(calls) != 0 {
				t.Fatalf("exported outside the diff: %v", calls)
			}
		})
	}
}

func TestGitHubExportRebasesBeforeRecheckingTheComment(t *testing.T) {
	f := newGitHubFixture(t)
	f.in.DisplayedMarkdown = "Inserted\nTitle\nBody\n"
	f.in.StartLine, f.in.EndLine = 3, 3
	file := f.responses[f.endpoint+"/files?per_page=100&page=1"].([]any)[0].(map[string]any)
	file["patch"] = "@@ -1,2 +1,3 @@\n+Inserted\n Title\n Body"
	f.write(t)
	if _, err := f.s.Invoke(context.Background(), "ExportCommentToGitHub", f.in); err != nil {
		t.Fatal("rebased comment was rejected:", err)
	}
	comments, err := f.s.Repository.ReadComments(f.s.CommentDocumentID(int64(f.in.DocumentID)))
	if err != nil || comments.Comments[0].StartLine != 3 || *comments.SourceSnapshot != f.in.DisplayedMarkdown {
		t.Fatalf("rebase was not saved: %+v %v", comments, err)
	}
}

func TestGitHubExportRejectsConcurrentRequestsAndClearsBusyState(t *testing.T) {
	f := newGitHubFixture(t)
	entered, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	t.Cleanup(unblock)
	f.s.ReadRemote = func(context.Context, string) (string, error) {
		close(entered)
		<-release
		return f.in.DisplayedMarkdown, nil
	}
	done := make(chan error, 1)
	go func() {
		_, err := f.s.Invoke(context.Background(), "ExportCommentToGitHub", f.in)
		done <- err
	}()
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("export did not start")
	}
	second := make(chan error, 1)
	go func() {
		_, err := f.s.Invoke(context.Background(), "ExportCommentToGitHub", f.in)
		second <- err
	}()
	select {
	case err := <-second:
		if err == nil || !strings.Contains(err.Error(), "export_busy") {
			t.Fatalf("concurrent export: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("concurrent request waited for the first export")
	}
	unblock()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if f.s.ExportInProgress() {
		t.Fatal("export remained busy after completing")
	}
}
