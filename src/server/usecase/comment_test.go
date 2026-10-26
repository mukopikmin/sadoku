package usecase

import (
	"fmt"
	"strings"
	"testing"
)

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

func TestRebaseLargeDocumentKeepsDistantMovedRanges(t *testing.T) {
	lines := make([]string, 4000)
	for i := range lines {
		lines[i] = fmt.Sprintf("original line %d", i)
	}
	before := strings.Join(lines, "\n")
	prefix := make([]string, 100)
	for i := range prefix {
		prefix[i] = fmt.Sprintf("inserted line %d", i)
	}
	after := strings.Join(append(prefix, lines...), "\n")
	comments, _, err := ChangeComment("CreateComment", Comments{Comments: []Comment{}}, CommentInput{StartLine: 2000, EndLine: 2001, Body: "Review"}, before, "2026-10-26T00:00:00.000Z")
	if err != nil {
		t.Fatal(err)
	}
	rebased := ResolveComments(comments, after).Comments[0]
	if rebased.Stale || rebased.StartLine != 2100 || rebased.EndLine != 2101 || rebased.OriginalStartLine != 2000 || rebased.OriginalEndLine != 2001 {
		t.Fatalf("large document range was lost: %+v", rebased)
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

func TestSourceRangesAndStableHashes(t *testing.T) {
	for _, test := range []struct {
		start, end int
		expected   *string
	}{
		{1, 2, stringPointer("first\nsecond")}, {2, 3, stringPointer("second\nthird")},
		{0, 1, nil}, {2, 1, nil}, {1, 4, nil},
	} {
		actual := RangeText("first\nsecond\nthird", test.start, test.end)
		if (actual == nil) != (test.expected == nil) || actual != nil && *actual != *test.expected {
			t.Errorf("range %d-%d: %v", test.start, test.end, actual)
		}
	}
	for text, expected := range map[string]string{"Body": "428a1095", "": "811c9dc5"} {
		if actual := HashSource(text); actual != expected {
			t.Errorf("hash %q: %s", text, actual)
		}
	}
}

func stringPointer(value string) *string { return &value }

func TestLegacyCommentSearchBoundaries(t *testing.T) {
	for _, test := range []struct {
		name, markdown, source    string
		start, end, expectedStart int
		stale                     bool
	}{
		{"unchanged", "# Title\n\nBody\n", "Body", 3, 3, 3, false},
		{"multi-line moved", "intro\nalpha\nbeta\noutro", "alpha\nbeta", 1, 2, 2, false},
		{"ambiguous range", "alpha\nbeta\nchanged\nalpha\nbeta", "alpha\nbeta", 1, 2, 1, true},
		{"deleted", "# Title\n\nremoved\n", "Body", 3, 3, 3, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			hash := HashSource(test.source)
			comment := Comment{StartLine: test.start, EndLine: test.end, SourceText: &test.source, SourceHash: &hash}
			actual := ResolveComments(Comments{Comments: []Comment{comment}}, test.markdown).Comments[0]
			if actual.StartLine != test.expectedStart || actual.Stale != test.stale || actual.OriginalStartLine != test.start || actual.OriginalEndLine != test.end {
				t.Fatalf("resolved position: %+v", actual)
			}
		})
	}
	for _, count := range []int{40, 41} {
		t.Run(fmt.Sprintf("search radius %d", count), func(t *testing.T) {
			before := []string{}
			for n := 0; n < count; n++ {
				before = append(before, fmt.Sprintf("before %d", n))
			}
			markdown := strings.Join(append(before, "Body"), "\n")
			text, hash := "Body", HashSource("Body")
			actual := ResolveComments(Comments{Comments: []Comment{{StartLine: 1, EndLine: 1, SourceText: &text, SourceHash: &hash}}}, markdown).Comments[0]
			if actual.Stale != (count == 41) {
				t.Fatalf("search radius changed: %+v", actual)
			}
			if count == 40 && actual.StartLine != 41 {
				t.Fatalf("did not follow line: %+v", actual)
			}
		})
	}
}

func TestCommentValidationAndReplyLifecycle(t *testing.T) {
	for _, test := range []CommentInput{{StartLine: 0, EndLine: 1, Body: "x"}, {StartLine: 2, EndLine: 1, Body: "x"}, {StartLine: 1, EndLine: 3, Body: "x"}, {StartLine: 1, EndLine: 1, Body: " \n"}} {
		if _, _, err := ChangeComment("CreateComment", Comments{}, test, "one\ntwo", "now"); err == nil {
			t.Fatalf("accepted invalid comment: %+v", test)
		}
	}
	doc, _, err := ChangeComment("CreateComment", Comments{}, CommentInput{StartLine: 1, EndLine: 1, Body: "comment"}, "source", "created")
	if err != nil {
		t.Fatal(err)
	}
	doc, _, err = ChangeComment("CreateReply", doc, CommentInput{CommentID: 1, Body: "reply", AsBot: true, RequestReview: true}, "source", "reply-created")
	if err != nil {
		t.Fatal(err)
	}
	doc, result, err := ChangeComment("UpdateReply", doc, CommentInput{CommentID: 1, ReplyID: 1, Body: " updated "}, "source", "reply-updated")
	if err != nil {
		t.Fatal(err)
	}
	reply := result.(Comment).Replies[0]
	if reply.Body != "updated" || reply.CreatedAt != "reply-created" || reply.UpdatedAt != "reply-updated" || !reply.ReviewRequested {
		t.Fatalf("reply metadata changed: %+v", reply)
	}
	doc, _, err = ChangeComment("SetCommentResolution", doc, CommentInput{CommentID: 1, Resolved: true}, "source", "resolved")
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err = ChangeComment("CreateReply", doc, CommentInput{CommentID: 1, Body: "review", AsBot: true, RequestReview: true}, "source", "later"); err == nil {
		t.Fatal("requested review on a resolved comment")
	}
	doc, _, err = ChangeComment("SetCommentResolution", doc, CommentInput{CommentID: 1, Resolved: false}, "source", "reopened")
	if err != nil {
		t.Fatal(err)
	}
	if doc.Comments[0].ResolvedAt != nil || doc.Comments[0].ResolvedBy != nil {
		t.Fatal("reopened comment retained resolution metadata")
	}
	doc, _, err = ChangeComment("DeleteReply", doc, CommentInput{CommentID: 1, ReplyID: 1}, "source", "deleted")
	if err != nil || len(doc.Comments[0].Replies) != 0 {
		t.Fatal("reply not removed", err)
	}
	if _, _, err = ChangeComment("DeleteComment", doc, CommentInput{CommentID: 99}, "source", "now"); err == nil {
		t.Fatal("deleted unknown comment")
	}
}
