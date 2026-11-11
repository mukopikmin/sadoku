package storage

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattn/go-sqlite3"
	"github.com/mukopikmin/sadoku/internal/server/db"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func TestCanceledSaveRollsBackCommentsAndRevisionsWithoutNotification(t *testing.T) {
	r := testRepository(t)
	doc, err := r.Ensure(t.Context(), "document.md")
	if err != nil {
		t.Fatal(err)
	}
	if err := r.InitializeSnapshot(t.Context(), doc.ID, "original"); err != nil {
		t.Fatal(err)
	}
	comments, _, err := u.ChangeComment("CreateComment", u.Comments{FilePath: doc.FilePath}, u.CommentInput{StartLine: 1, EndLine: 1, Body: "original review"}, "original", db.Now())
	if err != nil {
		t.Fatal(err)
	}
	if err := r.SaveComments(t.Context(), doc.ID, comments); err != nil {
		t.Fatal(err)
	}
	notification, err := r.CommentsNotificationPath(t.Context(), doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(notification)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	conn, err := r.DB.Conn(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	err = conn.Raw(func(raw any) error {
		return raw.(*sqlite3.SQLiteConn).RegisterFunc("cancel_save", func() int {
			cancel()
			return 0
		}, false)
	})
	closeErr := conn.Close()
	if err != nil || closeErr != nil {
		t.Fatalf("install cancellation callback: %v %v", err, closeErr)
	}
	// Cancel after a replacement row was inserted, after deleting the original
	// comments and recording a new revision inside the same transaction.
	if _, err := r.DB.ExecContext(t.Context(), `CREATE TRIGGER cancel_comment_save AFTER INSERT ON comment BEGIN SELECT cancel_save(); END`); err != nil {
		t.Fatal(err)
	}
	changed := "changed"
	comments.SourceSnapshot = &changed
	comments.Comments[0].Body = "changed review"
	err = r.SaveComments(ctx, doc.ID, comments)
	if !errors.Is(ctx.Err(), context.Canceled) || (!errors.Is(err, context.Canceled) && !errors.Is(err, sql.ErrTxDone)) {
		t.Fatalf("save error = %v, context = %v", err, ctx.Err())
	}
	saved, err := r.ReadComments(t.Context(), doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if saved.SourceSnapshot == nil || *saved.SourceSnapshot != "original" || len(saved.Comments) != 1 || saved.Comments[0].Body != "original review" {
		t.Fatalf("canceled transaction changed data: %+v", saved)
	}
	revisions, err := r.Revisions(t.Context(), doc.ID)
	if err != nil || len(revisions) != 1 {
		t.Fatalf("canceled transaction added revisions: %+v %v", revisions, err)
	}
	after, err := os.ReadFile(notification)
	if err != nil || !bytes.Equal(before, after) {
		t.Fatalf("canceled transaction emitted a notification: %q %v", after, err)
	}
}

func testRepository(t *testing.T) *Repository {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.sqlite3")
	database, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })
	return &Repository{DB: database, Path: path}
}

func TestCommittedSavePublishesNotificationAfterCancellation(t *testing.T) {
	r := testRepository(t)
	doc, err := r.Ensure(t.Context(), "document.md")
	if err != nil {
		t.Fatal(err)
	}
	comments, _, err := u.ChangeComment("CreateComment", u.Comments{FilePath: doc.FilePath}, u.CommentInput{StartLine: 1, EndLine: 1, Body: "review"}, "original", db.Now())
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	conn, err := r.DB.Conn(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	err = conn.Raw(func(raw any) error {
		raw.(*sqlite3.SQLiteConn).RegisterCommitHook(func() int {
			cancel()
			return 0
		})
		return nil
	})
	closeErr := conn.Close()
	if err != nil || closeErr != nil {
		t.Fatalf("install commit callback: %v %v", err, closeErr)
	}
	// Force notification lookup through PRAGMA database_list, which needs a live
	// SQL context even though the original request was canceled at commit time.
	r.Path = ""
	if err := r.SaveComments(ctx, doc.ID, comments); err != nil {
		t.Fatalf("committed save: %v", err)
	}
	if !errors.Is(ctx.Err(), context.Canceled) {
		t.Fatal("commit callback did not cancel the request")
	}
	path, err := r.CommentsNotificationPath(t.Context(), doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil || len(data) == 0 {
		t.Fatalf("committed change did not publish a notification: %q %v", data, err)
	}
}

func TestCommentsAndRevisionsRollbackTogether(t *testing.T) {
	r := testRepository(t)
	doc, err := r.Ensure(t.Context(), "document.md")
	if err != nil {
		t.Fatal(err)
	}
	if err = r.InitializeSnapshot(t.Context(), doc.ID, "original"); err != nil {
		t.Fatal(err)
	}
	if err = r.InitializeSnapshot(t.Context(), doc.ID, "ignored"); err != nil {
		t.Fatal(err)
	}
	comments, _, err := u.ChangeComment("CreateComment", u.Comments{FilePath: doc.FilePath}, u.CommentInput{StartLine: 1, EndLine: 1, Body: "review"}, "original", db.Now())
	if err != nil {
		t.Fatal(err)
	}
	if err = r.SaveComments(t.Context(), doc.ID, comments); err != nil {
		t.Fatal(err)
	}
	notification, err := r.CommentsNotificationPath(t.Context(), doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(notification)
	if err != nil || len(before) == 0 {
		t.Fatalf("missing committed-change notification: %q %v", before, err)
	}
	changed := "changed"
	comments.SourceSnapshot = &changed
	comments.Comments[0].Author.Type = "invalid"
	if err = r.SaveComments(t.Context(), doc.ID, comments); err == nil {
		t.Fatal("accepted invalid author")
	}
	after, err := os.ReadFile(notification)
	if err != nil || !bytes.Equal(before, after) {
		t.Fatalf("failed transaction emitted a notification: %q %v", after, err)
	}
	saved, err := r.ReadComments(t.Context(), doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if saved.SourceSnapshot == nil || *saved.SourceSnapshot != "original" || len(saved.Comments) != 1 || saved.Comments[0].Author.Type != "human" {
		t.Fatalf("failed save changed data: %+v", saved)
	}
	revisions, err := r.Revisions(t.Context(), doc.ID)
	if err != nil || len(revisions) != 1 {
		t.Fatalf("failed save added revisions: %+v %v", revisions, err)
	}
	if err = r.RecordRevision(t.Context(), doc.ID, "original"); err != nil {
		t.Fatal(err)
	}
	revisions, err = r.Revisions(t.Context(), doc.ID)
	if err != nil || len(revisions) != 1 {
		t.Fatal("unchanged revision duplicated", err)
	}
}

func TestScopedNotesAndAtomicTagReplacement(t *testing.T) {
	r := testRepository(t)
	one, err := r.Ensure(t.Context(), "one.md")
	if err != nil {
		t.Fatal(err)
	}
	two, err := r.Ensure(t.Context(), "two.md")
	if err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"instruction", "memory"} {
		note, err := r.SaveNote(t.Context(), kind, u.Note{DocumentID: one.ID, Content: "first"})
		if err != nil {
			t.Fatal(err)
		}
		if _, err = r.SaveNote(t.Context(), kind, u.Note{ID: note.ID, DocumentID: two.ID, Content: "wrong document"}); err == nil {
			t.Fatal("updated another document's note")
		}
		if err = r.DeleteNote(t.Context(), kind, two.ID, note.ID); err == nil {
			t.Fatal("deleted another document's note")
		}
		updated, err := r.SaveNote(t.Context(), kind, u.Note{ID: note.ID, DocumentID: one.ID, Content: "second"})
		if err != nil || updated.CreatedAt != note.CreatedAt || updated.Content != "second" {
			t.Fatalf("updated note: %+v %v", updated, err)
		}
		if err = r.DeleteNote(t.Context(), kind, one.ID, note.ID); err != nil {
			t.Fatal(err)
		}
		notes, err := r.Notes(t.Context(), kind, one.ID)
		if err != nil || len(notes) != 0 {
			t.Fatal("note deletion failed", err)
		}
	}
	tags, err := r.ReplaceTagReferences(t.Context(), one.ID, []u.TagReference{{Name: "API"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = r.ReplaceTagReferences(t.Context(), two.ID, []u.TagReference{{ID: tags[0].ID}}); err != nil {
		t.Fatal(err)
	}
	all, err := r.Tags(t.Context(), 0)
	if err != nil || len(all) != 1 || all[0].DocumentCount != 2 {
		t.Fatalf("tag count %+v %v", all, err)
	}
	if _, err = r.ReplaceTagReferences(t.Context(), one.ID, []u.TagReference{{Name: "must rollback"}, {ID: 9999}}); err == nil {
		t.Fatal("accepted nonexistent tag")
	}
	all, err = r.Tags(t.Context(), 0)
	if err != nil || len(all) != 1 {
		t.Fatalf("failed replacement left an orphan tag: %+v %v", all, err)
	}
	if err = r.DeleteTag(t.Context(), tags[0].ID); err != nil {
		t.Fatal(err)
	}
	for _, id := range []int64{one.ID, two.ID} {
		linked, err := r.Tags(t.Context(), id)
		if err != nil || len(linked) != 0 {
			t.Fatal("deleted tag links retained", err)
		}
	}
}

func TestRevisionsAreScopedAndBoundedWithoutChangingHistory(t *testing.T) {
	r := testRepository(t)
	one, _ := r.Ensure(t.Context(), "one.md")
	two, _ := r.Ensure(t.Context(), "two.md")
	for i := 0; i < 23; i++ {
		if err := r.RecordRevision(t.Context(), one.ID, string(rune('a'+i))); err != nil {
			t.Fatal(err)
		}
	}
	revisions, err := r.Revisions(t.Context(), one.ID)
	if err != nil || len(revisions) != 20 {
		t.Fatalf("revision count %d: %v", len(revisions), err)
	}
	for i, revision := range revisions {
		if i > 0 && revision.ID >= revisions[i-1].ID {
			t.Fatal("history not newest first")
		}
		if _, err = r.Revision(t.Context(), two.ID, revision.ID); err == nil {
			t.Fatal("read another document's revision")
		}
	}
	oldest, err := r.Revision(t.Context(), one.ID, revisions[len(revisions)-1].ID)
	if err != nil || oldest.PreviousMarkdown == nil || *oldest.PreviousMarkdown != "c" {
		t.Fatalf("lost predecessor outside list: %+v %v", oldest, err)
	}
	again, err := r.Revisions(t.Context(), one.ID)
	if err != nil || len(again) != 20 || again[0].ID != revisions[0].ID {
		t.Fatal("reads advanced history", err)
	}
}

func TestDirectoryRegistrationIsAtomicAndCancellable(t *testing.T) {
	r := testRepository(t)
	if _, err := r.DB.ExecContext(t.Context(), `CREATE TRIGGER reject_registration BEFORE INSERT ON comment_document WHEN NEW.file_path='reject.md' BEGIN SELECT RAISE(ABORT,'rejected'); END`); err != nil {
		t.Fatal(err)
	}
	if _, err := r.EnsureMany(context.Background(), []string{"first.md", "reject.md"}); err == nil {
		t.Fatal("accepted failed batch")
	}
	documents, err := r.Documents(t.Context())
	if err != nil || len(documents) != 0 {
		t.Fatalf("partial registration: %+v %v", documents, err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err = r.EnsureMany(ctx, []string{"cancelled.md"}); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled registration: %v", err)
	}
	documents, err = r.EnsureMany(context.Background(), []string{"second.md", "first.md"})
	if err != nil || len(documents) != 2 || documents[0].FilePath != "second.md" || documents[1].FilePath != "first.md" {
		t.Fatalf("batch order: %+v %v", documents, err)
	}
}

func TestUnchangedTagUpdatePreservesItsTimestamp(t *testing.T) {
	r := testRepository(t)
	tag, err := r.SaveTag(t.Context(), u.Tag{Name: "Review", BackgroundColor: "#123456"})
	if err != nil {
		t.Fatal(err)
	}
	const timestamp = "2020-01-01T00:00:00.000Z"
	if _, err := r.DB.ExecContext(t.Context(), "UPDATE document_tag SET updated_at=? WHERE id=?", timestamp, tag.ID); err != nil {
		t.Fatal(err)
	}
	unchanged, err := r.SaveTag(t.Context(), tag)
	if err != nil || unchanged.UpdatedAt != timestamp {
		t.Fatalf("unchanged tag: %+v %v", unchanged, err)
	}
	tag.Name = "Done"
	changed, err := r.SaveTag(t.Context(), tag)
	if err != nil || changed.UpdatedAt == timestamp {
		t.Fatalf("changed tag: %+v %v", changed, err)
	}
}
