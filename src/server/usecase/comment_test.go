package usecase

import "testing"

func TestCommentWorkflow(t *testing.T) {
	doc := Comments{Comments: []Comment{}}
	updated, result, err := ChangeComment("CreateComment", doc, CommentInput{StartLine: 2, EndLine: 3, Body: " review "}, "# Title\nfirst\nsecond", "2026-10-25T00:00:00.000Z")
	if err != nil {
		t.Fatal(err)
	}
	c := result.(Comment)
	if c.Body != "review" || c.ID != 1 || *c.SourceText != "first\nsecond" {
		t.Fatalf("comment: %+v", c)
	}
	updated, result, err = ChangeComment("CreateReply", updated, CommentInput{CommentID: 1, Body: "bot", AsBot: true, RequestReview: true}, "", "2026-10-25T00:00:01.000Z")
	if err != nil {
		t.Fatal(err)
	}
	if !result.(Comment).Replies[0].ReviewRequested {
		t.Fatal("missing review request")
	}
	_, _, err = ChangeComment("CreateReply", updated, CommentInput{CommentID: 1, Body: "human", RequestReview: true}, "", "")
	if err == nil {
		t.Fatal("accepted human review request")
	}
	resolved, _, err := ChangeComment("SetCommentResolution", updated, CommentInput{CommentID: 1, Resolved: true, AsBot: true}, "", "2026-10-25T00:00:02.000Z")
	if err != nil {
		t.Fatal(err)
	}
	if resolved.Comments[0].ResolvedBy.Type != "bot" {
		t.Fatal("missing resolver")
	}
}
func TestRebaseComments(t *testing.T) {
	before := "# Title\nfirst\nsecond\nremoved\nend"
	after := "# Title\ninserted\nfirst edited\nsecond\nend"
	doc := Comments{SourceSnapshot: &before, Comments: []Comment{{ID: 1, StartLine: 2, EndLine: 3}, {ID: 2, StartLine: 4, EndLine: 4}}}
	doc = ResolveComments(doc, after)
	if c := doc.Comments[0]; c.StartLine != 2 || c.EndLine != 4 || c.Stale || c.CurrentSourceText == nil {
		t.Fatalf("rebased: %+v", c)
	}
	if c := doc.Comments[1]; !c.Stale || !c.SourceDeleted || c.CurrentSourceText != nil {
		t.Fatalf("deleted: %+v", c)
	}
}
func TestLegacyCommentMatching(t *testing.T) {
	text := "Body"
	hash := HashSource(text)
	c := Comment{StartLine: 3, EndLine: 3, SourceText: &text, SourceHash: &hash}
	doc := ResolveComments(Comments{Comments: []Comment{c}}, "# Title\n\ninserted\nBody\n")
	if doc.Comments[0].StartLine != 4 || doc.Comments[0].Stale {
		t.Fatal(doc.Comments[0])
	}
	doc = ResolveComments(Comments{Comments: []Comment{c}}, "Body\nBody\n")
	if !doc.Comments[0].Stale {
		t.Fatal("ambiguous source accepted")
	}
}
