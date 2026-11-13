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

func TestNormalizedTableWidthUpdatesReuseRevisionAndRollbackAtomically(t *testing.T) {
	r := testRepository(t)
	doc, err := r.Ensure(t.Context(), "layout.md")
	if err != nil {
		t.Fatal(err)
	}
	state, err := u.ResolveTableLayouts(u.TableLayoutState{}, "| A | B |\n| - | - |", []u.TablePosition{{StartLine: 1, EndLine: 2, ColumnCount: 2}})
	if err != nil {
		t.Fatal(err)
	}
	if err = r.InitializeSnapshot(t.Context(), doc.ID, state.Markdown); err != nil {
		t.Fatal(err)
	}
	state.Tables[0].ColumnWidths = []float64{100, 200}
	if err = r.SaveTableLayouts(t.Context(), doc.ID, state); err != nil {
		t.Fatal(err)
	}
	var initialRevision int64
	if err = r.DB.QueryRowContext(t.Context(), "SELECT table_layout_revision_id FROM comment_document WHERE id=?", doc.ID).Scan(&initialRevision); err != nil {
		t.Fatal(err)
	}
	state.Tables[0].ColumnWidths = []float64{150, 0}
	if err = r.SaveTableLayouts(t.Context(), doc.ID, state); err != nil {
		t.Fatal(err)
	}
	var count int
	if err = r.DB.QueryRowContext(t.Context(), "SELECT count(*) FROM document_revision WHERE document_id=?", doc.ID).Scan(&count); err != nil || count != 1 {
		t.Fatalf("duplicated snapshot: %d %v", count, err)
	}
	if err = r.DB.QueryRowContext(t.Context(), "SELECT count(*) FROM markdown_table_column_width WHERE table_id=?", state.Tables[0].ID).Scan(&count); err != nil || count != 1 {
		t.Fatalf("automatic width persisted: %d %v", count, err)
	}
	state.Markdown = "changed source"
	state.Tables[0].ColumnWidths = []float64{10}
	if err = r.SaveTableLayouts(t.Context(), doc.ID, state); err == nil {
		t.Fatal("invalid width accepted")
	}
	restored, err := r.ReadTableLayouts(t.Context(), doc.ID)
	if err != nil || restored.Markdown != "| A | B |\n| - | - |" || !reflect.DeepEqual(restored.Tables[0].ColumnWidths, []float64{150}) {
		t.Fatalf("failed save changed state: %+v %v", restored, err)
	}
	var revision int64
	if err = r.DB.QueryRowContext(t.Context(), "SELECT table_layout_revision_id FROM comment_document WHERE id=?", doc.ID).Scan(&revision); err != nil || revision != initialRevision {
		t.Fatal("failed save changed revision reference")
	}
	if err = r.DB.QueryRowContext(t.Context(), "SELECT count(*) FROM document_revision WHERE document_id=?", doc.ID).Scan(&count); err != nil || count != 1 {
		t.Fatal("failed save left an extra revision")
	}
	state.Markdown = restored.Markdown
	state.Tables[0].ColumnWidths = nil
	if err = r.SaveTableLayouts(t.Context(), doc.ID, state); err != nil {
		t.Fatal(err)
	}
	if err = r.DB.QueryRowContext(t.Context(), "SELECT count(*) FROM markdown_table_column_width WHERE table_id=?", state.Tables[0].ID).Scan(&count); err != nil || count != 0 {
		t.Fatal("reset retained widths")
	}
}

func TestTableLayoutsCannotReuseAnotherDocumentsIdentityOrRevision(t *testing.T) {
	r := testRepository(t)
	one, err := r.Ensure(t.Context(), "one.md")
	if err != nil {
		t.Fatal(err)
	}
	two, err := r.Ensure(t.Context(), "two.md")
	if err != nil {
		t.Fatal(err)
	}
	state, err := u.ResolveTableLayouts(u.TableLayoutState{}, "| A |\n| - |", []u.TablePosition{{StartLine: 1, EndLine: 2, ColumnCount: 1}})
	if err != nil {
		t.Fatal(err)
	}
	state.Tables[0].ColumnWidths = []float64{200}
	if err = r.SaveTableLayouts(t.Context(), one.ID, state); err != nil {
		t.Fatal(err)
	}
	if err = r.SaveTableLayouts(t.Context(), two.ID, state); err == nil {
		t.Fatal("accepted another document's table ID")
	}
	restored, err := r.ReadTableLayouts(t.Context(), one.ID)
	if err != nil || !reflect.DeepEqual(restored, state) {
		t.Fatalf("modified another document: %+v %v", restored, err)
	}
	var count int
	if err = r.DB.QueryRowContext(t.Context(), "SELECT count(*) FROM document_revision WHERE document_id=?", two.ID).Scan(&count); err != nil || count != 0 {
		t.Fatal("failed identity transfer left a revision")
	}
	if _, err = r.DB.ExecContext(t.Context(), "UPDATE comment_document SET table_layout_revision_id=(SELECT table_layout_revision_id FROM comment_document WHERE id=?) WHERE id=?", one.ID, two.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = r.ReadTableLayouts(t.Context(), two.ID); err == nil {
		t.Fatal("accepted a comparison revision owned by another document")
	}
}

func TestWidthOnlySaveDoesNotTouchOtherTablesOrRevisionMetadata(t *testing.T) {
	r := testRepository(t)
	doc, err := r.Ensure(t.Context(), "width-only.md")
	if err != nil {
		t.Fatal(err)
	}
	markdown := "| A |\n| - |\n\n| B |\n| - |"
	state, err := u.ResolveTableLayouts(u.TableLayoutState{}, markdown, []u.TablePosition{{StartLine: 1, EndLine: 2, ColumnCount: 1}, {StartLine: 4, EndLine: 5, ColumnCount: 1}})
	if err != nil {
		t.Fatal(err)
	}
	state.Tables[0].ColumnWidths = []float64{100}
	state.Tables[1].ColumnWidths = []float64{200}
	if err = r.SaveTableLayouts(t.Context(), doc.ID, state); err != nil {
		t.Fatal(err)
	}
	for _, statement := range []string{
		`CREATE TRIGGER no_table_insert BEFORE INSERT ON markdown_table_layout BEGIN SELECT RAISE(ABORT,'unexpected table insert'); END`,
		`CREATE TRIGGER no_table_update BEFORE UPDATE ON markdown_table_layout BEGIN SELECT RAISE(ABORT,'unexpected table update'); END`,
		`CREATE TRIGGER no_table_delete BEFORE DELETE ON markdown_table_layout BEGIN SELECT RAISE(ABORT,'unexpected table delete'); END`,
		`CREATE TRIGGER no_revision_insert BEFORE INSERT ON document_revision BEGIN SELECT RAISE(ABORT,'unexpected revision'); END`,
		`CREATE TRIGGER no_document_update BEFORE UPDATE ON comment_document BEGIN SELECT RAISE(ABORT,'unexpected document update'); END`,
	} {
		if _, err = r.DB.ExecContext(t.Context(), statement); err != nil {
			t.Fatal(err)
		}
	}
	updated, err := r.SaveTableColumnWidths(t.Context(), doc.ID, state.Tables[0].ID, markdown, []float64{150})
	if err != nil || !reflect.DeepEqual(updated.ColumnWidths, []float64{150}) {
		t.Fatalf("width-only save: %+v %v", updated, err)
	}
	if _, err = r.SaveTableColumnWidths(t.Context(), doc.ID, state.Tables[0].ID, "stale source", []float64{170}); err == nil {
		t.Fatal("accepted stale revision")
	}
	if _, err = r.SaveTableColumnWidths(t.Context(), doc.ID, state.Tables[0].ID, markdown, []float64{20}); err == nil {
		t.Fatal("accepted invalid width")
	}
	restored, err := r.ReadTableLayouts(t.Context(), doc.ID)
	if err != nil || !reflect.DeepEqual(restored.Tables[0].ColumnWidths, []float64{150}) || !reflect.DeepEqual(restored.Tables[1], state.Tables[1]) {
		t.Fatalf("affected another table or lost previous width: %+v %v", restored, err)
	}
	if _, err = r.SaveTableColumnWidths(t.Context(), doc.ID, state.Tables[0].ID, markdown, nil); err != nil {
		t.Fatal(err)
	}
}
