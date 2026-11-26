package session

import (
	"context"
	"testing"

	"github.com/mukopikmin/sadoku/internal/server/db"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

type countingCommentReads struct {
	u.Repository
	reads int
}

func (r *countingCommentReads) ReadComments(ctx context.Context, id int64) (u.Comments, error) {
	r.reads++
	return r.Repository.ReadComments(ctx, id)
}

func TestListCommentsReadsOnceAfterSourceIO(t *testing.T) {
	s, repo := snapshotSession(t, 1)
	counter := &countingCommentReads{Repository: repo}
	s.Repository = counter
	id := s.Documents[0].ID
	s.ReadRemote = func(ctx context.Context, source string) (string, error) {
		doc, _, err := u.ChangeComment("CreateComment", u.Comments{}, u.CommentInput{StartLine: 1, EndLine: 1, Body: "concurrent review"}, "text", db.Now())
		if err != nil {
			return "", err
		}
		return "text", repo.SaveComments(ctx, id, doc)
	}
	result, err := s.Invoke(t.Context(), "ListComments", Input{DocumentID: ID(id)})
	if err != nil {
		t.Fatal(err)
	}
	got := result.(u.Comments)
	if counter.reads != 1 || len(got.Comments) != 1 || got.Comments[0].Body != "concurrent review" {
		t.Fatalf("reads=%d comments=%+v", counter.reads, got)
	}
}
