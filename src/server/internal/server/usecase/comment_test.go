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
	if c := doc.Comments[0]; c.StartLine != 3 || c.EndLine != 4 || c.Stale || c.CurrentSourceText == nil {
		t.Fatalf("rebased: %+v", c)
	}
	if c := doc.Comments[1]; !c.Stale || !c.SourceDeleted || c.CurrentSourceText != nil {
		t.Fatalf("deleted: %+v", c)
	}
}

func TestRebaseCommentsKeepsEditedRangesSeparate(t *testing.T) {
	for _, test := range []struct {
		name, before, after string
		start, end          int
		wantStart, wantEnd  int
	}{
		{"adjacent edits", "# Title\nTarget paragraph\nNeighbor paragraph\nend", "# Title\nTarget paragraph edited\nNeighbor paragraph edited\nend", 2, 2, 2, 2},
		{"adjacent replacements", "# Title\nTarget old\nNeighbor old\nend", "# Title\nTarget new\nNeighbor new\nend", 2, 2, 2, 2},
		{"edited list items", "# Title\n- First item\n- Second item\nend", "# Title\n- First changed\n- Second changed\nend", 3, 3, 3, 3},
		{"insert before edited target", "# Title\nTarget paragraph\nend", "# Title\nNew introduction\nTarget paragraph edited\nend", 2, 2, 3, 3},
		{"insert after edited target", "# Title\nTarget paragraph\nend", "# Title\nTarget paragraph edited\nNew conclusion\nend", 2, 2, 2, 2},
		{"split target", "# Title\nTarget paragraph continues here\nNeighbor paragraph\nend", "# Title\nTarget paragraph\ncontinues here\nNeighbor paragraph edited\nend", 2, 2, 2, 3},
		{"merge target", "# Title\nTarget paragraph\ncontinues here\nNeighbor paragraph\nend", "# Title\nTarget paragraph continues here\nNeighbor paragraph edited\nend", 2, 3, 2, 2},
		{"Japanese and emoji", "# 見出し\n対象の文章です🐱\n隣の文章です🐶\n終わり", "# 見出し\n導入を追加\n対象の文章を修正しました🐱\n隣の文章を修正しました🐶\n終わり", 2, 2, 3, 3},
		{"unchanged target after nearby deletion", "# Title\nremove me\nTarget paragraph\nend", "# Title\nTarget paragraph\nend", 3, 3, 2, 2},
		{"full replacement", "# Title\nabc\nend", "# Title\nXYZ\nUVW\nend", 2, 2, 2, 3},
		{"full replacement beside edited text", "# Title\nabc\nTarget paragraph\nend", "# Title\nXYZ\nTarget paragraph edited\nend", 2, 2, 2, 2},
		{"large replacement", "# Title\n" + strings.Repeat("a", 1000) + "\nend", "# Title\n" + strings.Repeat("b", 1000) + "\n" + strings.Repeat("c", 1000) + "\nend", 2, 2, 2, 3},
	} {
		t.Run(test.name, func(t *testing.T) {
			doc, _, err := ChangeComment("CreateComment", Comments{}, CommentInput{StartLine: test.start, EndLine: test.end, Body: "Review"}, test.before, "created")
			if err != nil {
				t.Fatal(err)
			}
			original := *doc.Comments[0].SourceText
			for _, markdown := range []string{test.after, "prefix\n" + test.after} {
				doc = ResolveComments(doc, markdown)
				c := doc.Comments[0]
				shift := 0
				if strings.HasPrefix(markdown, "prefix\n") {
					shift = 1
				}
				if c.Stale || c.SourceDeleted || c.StartLine != test.wantStart+shift || c.EndLine != test.wantEnd+shift || c.DisplayLine != c.StartLine {
					t.Fatalf("comment attached to surrounding text: %+v", c)
				}
				if c.CurrentSourceText == nil || *c.CurrentSourceText != *RangeText(markdown, test.wantStart+shift, test.wantEnd+shift) {
					t.Fatalf("incorrect current source: %+v", c)
				}
				if *c.SourceText != original || c.OriginalStartLine != test.start || c.OriginalEndLine != test.end {
					t.Fatalf("original source changed: %+v", c)
				}
			}
		})
	}
}

func TestRebaseDeletedCommentBesideEditedText(t *testing.T) {
	before := "# Title\nDELETE\nTarget paragraph\nend"
	doc, _, err := ChangeComment("CreateComment", Comments{}, CommentInput{StartLine: 2, EndLine: 2, Body: "Review removed text"}, before, "created")
	if err != nil {
		t.Fatal(err)
	}
	doc, _, err = ChangeComment("CreateComment", doc, CommentInput{StartLine: 3, EndLine: 3, Body: "Review remaining text"}, before, "created")
	if err != nil {
		t.Fatal(err)
	}
	doc = ResolveComments(doc, "# Title\nTarget paragraph edited\nend")
	if c := doc.Comments[0]; !c.Stale || !c.SourceDeleted || c.CurrentSourceText != nil {
		t.Fatalf("deleted comment attached to edited neighbor: %+v", c)
	}
	if c := doc.Comments[1]; c.Stale || c.StartLine != 2 || c.EndLine != 2 || c.CurrentSourceText == nil || *c.CurrentSourceText != "Target paragraph edited" {
		t.Fatalf("remaining comment did not follow edited text: %+v", c)
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
		{"single-line moved", "# Title\n\ninserted\nBody\n", "Body", 3, 3, 4, false},
		{"single-line ambiguous", "Body\nBody\n", "Body", 3, 3, 3, true},
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
