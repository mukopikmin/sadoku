package storage

import (
	"path/filepath"
	"testing"

	"github.com/mukopikmin/sadoku/src/server/db"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

func testRepository(t *testing.T) *Repository {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.sqlite3")
	database, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { database.Close() })
	return &Repository{DB: database, Path: path}
}

func TestCommentsAndRevisionsRollbackTogether(t *testing.T) {
	r := testRepository(t)
	doc, err := r.Ensure("document.md")
	if err != nil {
		t.Fatal(err)
	}
	if err = r.InitializeSnapshot(doc.ID, "original"); err != nil {
		t.Fatal(err)
	}
	if err = r.InitializeSnapshot(doc.ID, "ignored"); err != nil {
		t.Fatal(err)
	}
	comments, _, err := u.ChangeComment("CreateComment", u.Comments{FilePath: doc.FilePath}, u.CommentInput{StartLine: 1, EndLine: 1, Body: "review"}, "original", db.Now())
	if err != nil {
		t.Fatal(err)
	}
	if err = r.SaveComments(doc.ID, comments); err != nil {
		t.Fatal(err)
	}
	changed := "changed"
	comments.SourceSnapshot = &changed
	comments.Comments[0].Author.Type = "invalid"
	if err = r.SaveComments(doc.ID, comments); err == nil {
		t.Fatal("accepted invalid author")
	}
	saved, err := r.ReadComments(doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if saved.SourceSnapshot == nil || *saved.SourceSnapshot != "original" || len(saved.Comments) != 1 || saved.Comments[0].Author.Type != "human" {
		t.Fatalf("failed save changed data: %+v", saved)
	}
	revisions, err := r.Revisions(doc.ID)
	if err != nil || len(revisions) != 1 {
		t.Fatalf("failed save added revisions: %+v %v", revisions, err)
	}
	if err = r.RecordRevision(doc.ID, "original"); err != nil {
		t.Fatal(err)
	}
	revisions, err = r.Revisions(doc.ID)
	if err != nil || len(revisions) != 1 {
		t.Fatal("unchanged revision duplicated", err)
	}
}

func TestScopedNotesAndAtomicTagReplacement(t *testing.T) {
	r := testRepository(t)
	one, err := r.Ensure("one.md")
	if err != nil {
		t.Fatal(err)
	}
	two, err := r.Ensure("two.md")
	if err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"instruction", "memory"} {
		note, err := r.SaveNote(kind, u.Note{DocumentID: one.ID, Content: "first"})
		if err != nil {
			t.Fatal(err)
		}
		if _, err = r.SaveNote(kind, u.Note{ID: note.ID, DocumentID: two.ID, Content: "wrong document"}); err == nil {
			t.Fatal("updated another document's note")
		}
		if err = r.DeleteNote(kind, two.ID, note.ID); err == nil {
			t.Fatal("deleted another document's note")
		}
		updated, err := r.SaveNote(kind, u.Note{ID: note.ID, DocumentID: one.ID, Content: "second"})
		if err != nil || updated.CreatedAt != note.CreatedAt || updated.Content != "second" {
			t.Fatalf("updated note: %+v %v", updated, err)
		}
		if err = r.DeleteNote(kind, one.ID, note.ID); err != nil {
			t.Fatal(err)
		}
		notes, err := r.Notes(kind, one.ID)
		if err != nil || len(notes) != 0 {
			t.Fatal("note deletion failed", err)
		}
	}
	tags, err := r.ReplaceTagReferences(one.ID, []u.TagReference{{Name: "API"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = r.ReplaceTagReferences(two.ID, []u.TagReference{{ID: tags[0].ID}}); err != nil {
		t.Fatal(err)
	}
	all, err := r.Tags(0)
	if err != nil || len(all) != 1 || all[0].DocumentCount != 2 {
		t.Fatalf("tag count %+v %v", all, err)
	}
	if _, err = r.ReplaceTagReferences(one.ID, []u.TagReference{{Name: "must rollback"}, {ID: 9999}}); err == nil {
		t.Fatal("accepted nonexistent tag")
	}
	all, err = r.Tags(0)
	if err != nil || len(all) != 1 {
		t.Fatalf("failed replacement left an orphan tag: %+v %v", all, err)
	}
	if err = r.DeleteTag(tags[0].ID); err != nil {
		t.Fatal(err)
	}
	for _, id := range []int64{one.ID, two.ID} {
		linked, err := r.Tags(id)
		if err != nil || len(linked) != 0 {
			t.Fatal("deleted tag links retained", err)
		}
	}
}

func TestRevisionsAreScopedAndBoundedWithoutChangingHistory(t *testing.T) {
	r := testRepository(t)
	one, _ := r.Ensure("one.md")
	two, _ := r.Ensure("two.md")
	for i := 0; i < 23; i++ {
		if err := r.RecordRevision(one.ID, string(rune('a'+i))); err != nil {
			t.Fatal(err)
		}
	}
	revisions, err := r.Revisions(one.ID)
	if err != nil || len(revisions) != 20 {
		t.Fatalf("revision count %d: %v", len(revisions), err)
	}
	for i, revision := range revisions {
		if i > 0 && revision.ID >= revisions[i-1].ID {
			t.Fatal("history not newest first")
		}
		if _, err = r.Revision(two.ID, revision.ID); err == nil {
			t.Fatal("read another document's revision")
		}
	}
	oldest, err := r.Revision(one.ID, revisions[len(revisions)-1].ID)
	if err != nil || oldest.PreviousMarkdown == nil || *oldest.PreviousMarkdown != "c" {
		t.Fatalf("lost predecessor outside list: %+v %v", oldest, err)
	}
	again, err := r.Revisions(one.ID)
	if err != nil || len(again) != 20 || again[0].ID != revisions[0].ID {
		t.Fatal("reads advanced history", err)
	}
}
