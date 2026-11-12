package storage

import (
	"reflect"
	"testing"

	"github.com/mukopikmin/sadoku/internal/server/db"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func TestTableLayoutsSurviveReopenAndCascadeWithDocument(t *testing.T) {
	r := testRepository(t)
	doc, err := r.Ensure(t.Context(), "table.md")
	if err != nil {
		t.Fatal(err)
	}
	state, err := u.ResolveTableLayouts(u.TableLayoutState{}, "| A | B |\n| - | - |", []u.TablePosition{{StartLine: 1, EndLine: 2, ColumnCount: 2}})
	if err != nil {
		t.Fatal(err)
	}
	state.Tables[0].ColumnWidths = []float64{100, 200}
	if err := r.SaveTableLayouts(t.Context(), doc.ID, state); err != nil {
		t.Fatal(err)
	}
	if err := r.DB.Close(); err != nil {
		t.Fatal(err)
	}
	database, err := db.Open(r.Path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })
	r.DB = database
	restored, err := r.ReadTableLayouts(t.Context(), doc.ID)
	if err != nil || !reflect.DeepEqual(restored, state) {
		t.Fatalf("reopened layouts: %+v, %v", restored, err)
	}
	if _, err := r.DB.ExecContext(t.Context(), "DELETE FROM comment_document WHERE id=?", doc.ID); err != nil {
		t.Fatal(err)
	}
	restored, err = r.ReadTableLayouts(t.Context(), doc.ID)
	if err != nil || len(restored.Tables) != 0 {
		t.Fatalf("deleted document layouts: %+v, %v", restored, err)
	}
	if err := r.SaveTableLayouts(t.Context(), doc.ID, state); err == nil {
		t.Fatal("accepted layouts for a missing document")
	}
}
