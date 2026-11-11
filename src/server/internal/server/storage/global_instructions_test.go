package storage

import (
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
	"testing"
)

func TestGlobalInstructionsRemainIndependentOfDocuments(t *testing.T) {
	r := testRepository(t)
	global, err := r.SaveGlobalInstruction(t.Context(), u.Note{Content: "Shared guidance"})
	if err != nil {
		t.Fatal(err)
	}
	doc, err := r.Ensure(t.Context(), "doc.md")
	if err != nil {
		t.Fatal(err)
	}
	local, err := r.SaveNote(t.Context(), "instruction", u.Note{DocumentID: doc.ID, Content: "Local guidance"})
	if err != nil {
		t.Fatal(err)
	}
	if global.ID != local.ID {
		t.Fatal("expected overlapping IDs in separate scopes")
	}
	global.Content = "Updated shared guidance"
	updated, err := r.SaveGlobalInstruction(t.Context(), global)
	if err != nil || updated.CreatedAt != global.CreatedAt || updated.Content != global.Content {
		t.Fatalf("update: %+v %v", updated, err)
	}
	notes, err := r.Notes(t.Context(), "instruction", doc.ID)
	if err != nil || len(notes) != 1 || notes[0].Content != "Local guidance" {
		t.Fatalf("local scope: %+v %v", notes, err)
	}
	if _, err := r.DB.ExecContext(t.Context(), "DELETE FROM comment_document WHERE id=?", doc.ID); err != nil {
		t.Fatal(err)
	}
	notes, err = r.GlobalInstructions(t.Context())
	if err != nil || len(notes) != 1 || notes[0].Content != global.Content {
		t.Fatalf("global lost on document delete: %+v %v", notes, err)
	}
	if err := r.DeleteGlobalInstruction(t.Context(), global.ID); err != nil {
		t.Fatal(err)
	}
	notes, err = r.GlobalInstructions(t.Context())
	if err != nil || len(notes) != 0 {
		t.Fatalf("delete: %+v %v", notes, err)
	}
	if _, err := r.SaveGlobalInstruction(t.Context(), global); err == nil {
		t.Fatal("update recreated deleted instruction")
	}
}

func TestSavingInstructionReplacesOnlyItsScope(t *testing.T) {
	r := testRepository(t)
	one, err := r.Ensure(t.Context(), "one.md")
	if err != nil {
		t.Fatal(err)
	}
	two, err := r.Ensure(t.Context(), "two.md")
	if err != nil {
		t.Fatal(err)
	}
	save := func(docID int64, content string) u.Note {
		t.Helper()
		var n u.Note
		var err error
		if docID == 0 {
			n, err = r.SaveGlobalInstruction(t.Context(), u.Note{Content: content})
		} else {
			n, err = r.SaveNote(t.Context(), "instruction", u.Note{DocumentID: docID, Content: content})
		}
		if err != nil {
			t.Fatal(err)
		}
		return n
	}
	for _, docID := range []int64{0, one.ID, two.ID} {
		first := save(docID, "First")
		updated := save(docID, "Replacement")
		if updated.ID != first.ID || updated.CreatedAt != first.CreatedAt || updated.Content != "Replacement" {
			t.Fatalf("replacement: %+v %+v", first, updated)
		}
	}
	for _, docID := range []int64{0, one.ID, two.ID} {
		var notes []u.Note
		if docID == 0 {
			notes, err = r.GlobalInstructions(t.Context())
		} else {
			notes, err = r.Notes(t.Context(), "instruction", docID)
		}
		if err != nil || len(notes) != 1 || notes[0].Content != "Replacement" {
			t.Fatalf("scope %d: %+v %v", docID, notes, err)
		}
	}
	for _, content := range []string{"First memory", "Second memory"} {
		if _, err := r.SaveNote(t.Context(), "memory", u.Note{DocumentID: one.ID, Content: content}); err != nil {
			t.Fatal(err)
		}
	}
	notes, err := r.Notes(t.Context(), "memory", one.ID)
	if err != nil || len(notes) != 2 {
		t.Fatalf("memories: %+v %v", notes, err)
	}
}
