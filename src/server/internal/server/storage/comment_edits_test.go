package storage

import (
	"testing"

	"github.com/mukopikmin/sadoku/internal/server/db"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func TestCommentEditsOnlyWriteTheirTargetsAndRollBackTogether(t *testing.T) {
	ctx := t.Context()
	repo := testRepository(t)
	document, err := repo.Ensure(ctx, "review.md")
	if err != nil {
		t.Fatal(err)
	}
	doc := u.Comments{}
	for range 2 {
		doc, _, err = u.ChangeComment("CreateComment", doc, u.CommentInput{StartLine: 1, EndLine: 1, Body: "review"}, "text", db.Now())
		if err != nil {
			t.Fatal(err)
		}
	}
	if err := repo.SaveComments(ctx, document.ID, doc); err != nil {
		t.Fatal(err)
	}
	doc, err = repo.ReadComments(ctx, document.ID)
	if err != nil {
		t.Fatal(err)
	}
	// Guard the untouched sibling against updates as well as replacement.
	for _, op := range []string{"UPDATE", "DELETE", "INSERT"} {
		row := "OLD"
		if op == "INSERT" {
			row = "NEW"
		}
		_, err := repo.DB.ExecContext(ctx, "CREATE TRIGGER guard_"+op+" BEFORE "+op+" ON comment WHEN "+row+".local_id=2 BEGIN SELECT RAISE(ABORT, 'unrelated comment touched'); END")
		if err != nil {
			t.Fatal(err)
		}
	}
	_, resolve, err := u.ChangeComment("SetCommentResolution", doc, u.CommentInput{CommentID: 1, Resolved: true}, "", db.Now())
	if err != nil {
		t.Fatal(err)
	}
	missing := resolve
	missing.Comment.ID = 3
	if err := repo.SaveCommentEdits(ctx, document.ID, doc.Version, nil, []u.CommentEdit{resolve, missing}); err == nil {
		t.Fatal("invalid batch committed")
	}
	saved, err := repo.ReadComments(ctx, document.ID)
	if err != nil || saved.Comments[0].Resolved {
		t.Fatalf("partial batch: %+v, %v", saved, err)
	}
	if err := repo.SaveCommentEdits(ctx, document.ID, doc.Version, nil, []u.CommentEdit{resolve}); err != nil {
		t.Fatal(err)
	}
	if err := repo.SaveCommentEdits(ctx, document.ID, doc.Version, nil, []u.CommentEdit{resolve}); err == nil {
		t.Fatal("stale edit committed")
	}
	doc, err = repo.ReadComments(ctx, document.ID)
	if err != nil {
		t.Fatal(err)
	}
	_, reply, err := u.ChangeComment("CreateReply", doc, u.CommentInput{CommentID: 1, Body: "reply"}, "", db.Now())
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.SaveCommentEdits(ctx, document.ID, doc.Version, nil, []u.CommentEdit{reply}); err != nil {
		t.Fatal(err)
	}
	saved, err = repo.ReadComments(ctx, document.ID)
	if err != nil || !saved.Comments[0].Resolved || len(saved.Comments[0].Replies) != 1 || len(saved.Comments[1].Replies) != 0 {
		t.Fatalf("persisted edits: %+v, %v", saved, err)
	}
}
