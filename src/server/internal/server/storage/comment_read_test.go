package storage

import (
	"testing"

	"github.com/mukopikmin/sadoku/internal/server/db"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func TestReadCommentsGroupsRepliesByDocumentAndParent(t *testing.T) {
	repo := testRepository(t)
	for _, path := range []string{"a.md", "b.md"} {
		document, err := repo.Ensure(t.Context(), path)
		if err != nil {
			t.Fatal(err)
		}
		comments := u.Comments{}
		for range 3 {
			comments, _, err = u.ChangeComment("CreateComment", comments, u.CommentInput{StartLine: 1, EndLine: 1, Body: path}, "line", db.Now())
			if err != nil {
				t.Fatal(err)
			}
		}
		for _, id := range []int64{3, 1, 3} {
			comments, _, err = u.ChangeComment("CreateReply", comments, u.CommentInput{CommentID: id, Body: path}, "line", db.Now())
			if err != nil {
				t.Fatal(err)
			}
		}
		if err := repo.SaveComments(t.Context(), document.ID, comments); err != nil {
			t.Fatal(err)
		}
		got, err := repo.ReadComments(t.Context(), document.ID)
		if err != nil {
			t.Fatal(err)
		}
		for i, want := range comments.Comments {
			replies := got.Comments[i].Replies
			if replies == nil || len(replies) != len(want.Replies) {
				t.Fatalf("comment %d replies: %+v", i, replies)
			}
			for j, reply := range replies {
				if reply != want.Replies[j] {
					t.Fatalf("comment %d reply %d: %+v", i, j, reply)
				}
			}
		}
	}
}
