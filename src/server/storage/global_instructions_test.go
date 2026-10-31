package storage

import (
	u "github.com/mukopikmin/sadoku/src/server/usecase"
	"testing"
)

func TestGlobalInstructionsRemainIndependentOfDocuments(t *testing.T) {
	r := testRepository(t)
	global, err := r.SaveGlobalInstruction(u.Note{Content: "Shared guidance"})
	if err != nil {
		t.Fatal(err)
	}
	doc, err := r.Ensure("doc.md")
	if err != nil {
		t.Fatal(err)
	}
	local, err := r.SaveNote("instruction", u.Note{DocumentID: doc.ID, Content: "Local guidance"})
	if err != nil {
		t.Fatal(err)
	}
	if global.ID != local.ID {
		t.Fatal("expected overlapping IDs in separate scopes")
	}
	global.Content = "Updated shared guidance"
	updated, err := r.SaveGlobalInstruction(global)
	if err != nil || updated.CreatedAt != global.CreatedAt || updated.Content != global.Content {
		t.Fatalf("update: %+v %v", updated, err)
	}
	notes, err := r.Notes("instruction", doc.ID)
	if err != nil || len(notes) != 1 || notes[0].Content != "Local guidance" {
		t.Fatalf("local scope: %+v %v", notes, err)
	}
	if _, err := r.DB.Exec("DELETE FROM comment_document WHERE id=?", doc.ID); err != nil {
		t.Fatal(err)
	}
	notes, err = r.GlobalInstructions()
	if err != nil || len(notes) != 1 || notes[0].Content != global.Content {
		t.Fatalf("global lost on document delete: %+v %v", notes, err)
	}
	if err := r.DeleteGlobalInstruction(global.ID); err != nil {
		t.Fatal(err)
	}
	notes, err = r.GlobalInstructions()
	if err != nil || len(notes) != 0 {
		t.Fatalf("delete: %+v %v", notes, err)
	}
	if _, err := r.SaveGlobalInstruction(global); err == nil {
		t.Fatal("update recreated deleted instruction")
	}
}
