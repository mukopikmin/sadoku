package session

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	"github.com/mukopikmin/sadoku/src/server/storage"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

func TestPullPreservesCanonicalCommentsAndCreatesOnlyPendingReviews(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("fake gh fixture uses a POSIX shell")
	}
	root := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(root, "config"))
	sha := strings.Repeat("a", 40)
	markdown := "# Title\nBody\n"
	pullURL := "https://github.com/owner/repo/pull/1"
	path := filepath.Join(root, "db.sqlite3")
	database, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	repo := &storage.Repository{DB: database, Path: path}
	// Previous versions stored PR comments at the Contents API's canonical URL,
	// separately from the PR document registration and its archival revisions.
	canonical := "https://api.github.com/repos/owner/repo/contents/readme.md"
	old, err := repo.Ensure(canonical)
	if err != nil {
		t.Fatal(err)
	}
	comments, _, err := u.ChangeComment("CreateComment", u.Comments{FilePath: canonical, Comments: []u.Comment{}}, u.CommentInput{StartLine: 2, EndLine: 2, Body: "Review"}, markdown, "2026-10-25T00:00:00.000Z")
	if err != nil {
		t.Fatal(err)
	}
	if err = repo.SaveComments(old.ID, comments); err != nil {
		t.Fatal(err)
	}
	responses := map[string]any{
		"repos/owner/repo/pulls/1":                           map[string]any{"node_id": "pull1", "title": "Example", "body": "Details", "state": "open", "head": map[string]any{"sha": sha}},
		"repos/owner/repo/pulls/1/files?per_page=100&page=1": []any{map[string]any{"filename": "readme.md", "status": "modified", "patch": "@@ -1,2 +1,2 @@\n # Title\n+Body"}},
		"user": map[string]any{"login": "tester"},
		"repos/owner/repo/pulls/1/reviews?per_page=100&page=1":  []any{},
		"repos/owner/repo/pulls/1/comments?per_page=100&page=1": []any{},
	}
	quote := func(s string) string { return "'" + strings.ReplaceAll(s, "'", "'\"'\"'") + "'" }
	var script strings.Builder
	script.WriteString("#!/bin/sh\nfor endpoint do :; done\ncase \"$endpoint\" in\n")
	for endpoint, response := range responses {
		b, _ := json.Marshal(response)
		fmt.Fprintf(&script, "%s) printf '%%s' %s ;;\n", quote(endpoint), quote(string(b)))
	}
	fmt.Fprintf(&script, "%s) printf '%%s' %s ;;\n", quote("repos/owner/repo/contents/readme.md?ref="+sha), quote(markdown))
	mutationLog := filepath.Join(root, "mutation.json")
	fmt.Fprintf(&script, "graphql) cat > %s; printf '%%s' %s ;;\n", quote(mutationLog), quote(`{"data":{"addPullRequestReview":{"pullRequestReview":{"id":"review1","state":"PENDING"}}}}`))
	script.WriteString("*) exit 1 ;;\nesac\n")
	if err = os.WriteFile(filepath.Join(root, "gh"), []byte(script.String()), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", root+string(os.PathListSeparator)+os.Getenv("PATH"))
	s, err := New(context.Background(), pullURL, repo, config.Defaults())
	if err != nil {
		t.Fatal(err)
	}
	doc := s.Documents[0]
	if doc.ID == old.ID || s.CommentDocumentID(doc.ID) != old.ID {
		t.Fatal("canonical comment identity was not preserved")
	}
	result, err := s.Invoke(context.Background(), "ListComments", Input{DocumentID: ID(doc.ID)})
	if err != nil {
		t.Fatal(err)
	}
	if got := result.(u.Comments); len(got.Comments) != 1 || got.Comments[0].Body != "Review" {
		t.Fatal(got)
	}
	in := Input{DocumentID: ID(doc.ID), CommentID: 1, HeadSHA: sha, DisplayedMarkdown: markdown, CreatedAt: "2026-10-25T00:00:00.000Z", Body: "Review", StartLine: 2, EndLine: 2}
	result, err = s.Invoke(context.Background(), "ExportCommentToGitHub", in)
	if err != nil {
		t.Fatal(err)
	}
	if got := result.(map[string]any); got["state"] != "pending" || got["url"] != pullURL+"/files" {
		t.Fatal(got)
	}
	b, err := os.ReadFile(mutationLog)
	if err != nil {
		t.Fatal(err)
	}
	var mutation struct {
		Query     string
		Variables map[string]any
	}
	if err = json.Unmarshal(b, &mutation); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(mutation.Query, "event:") || !strings.Contains(mutation.Query, "addPullRequestReview(") || mutation.Variables["sha"] != sha {
		t.Fatal("review would be submitted or target the wrong head", string(b))
	}
	in.HeadSHA = strings.Repeat("b", 40)
	if _, err = s.Invoke(context.Background(), "ExportCommentToGitHub", in); err == nil {
		t.Fatal("accepted a stale displayed head")
	}
}
