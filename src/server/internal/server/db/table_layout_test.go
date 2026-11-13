package db

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func layoutDatabase17(t *testing.T, state string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "layouts.sqlite3")
	database, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = database.Close() }()
	var additions []migration
	if err = json.Unmarshal(current, &additions); err != nil {
		t.Fatal(err)
	}
	for _, statement := range []string{
		"DROP TABLE markdown_table_column_width", "DROP TABLE markdown_table_layout",
		"ALTER TABLE comment_document DROP COLUMN table_layout_revision_id",
		"DELETE FROM schema_migration WHERE version='0018'",
		additions[2].Statements[0],
		"INSERT INTO comment_document(id,file_path,created_at,updated_at) VALUES(1,'one.md','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')",
		"INSERT INTO document_revision(id,document_id,markdown) VALUES(10,1,'saved source')",
		"UPDATE comment_document SET source_revision_id=10 WHERE id=1",
	} {
		if _, err = database.ExecContext(t.Context(), statement); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = database.ExecContext(t.Context(), "INSERT INTO document_table_layout(document_id,state) VALUES(1,?)", state); err != nil {
		t.Fatal(err)
	}
	return path
}

const savedLayoutJSON = `{"markdown":"saved source","tables":[{"id":"existing-table","startLine":1,"endLine":3,"columnCount":3,"columnWidths":[100,0,320]}]}`

func TestNormalizeTableLayoutsPreservesIDsWidthsAndReusesRevision(t *testing.T) {
	for _, source := range []string{"saved source", "different layout source"} {
		t.Run(source, func(t *testing.T) {
			state := strings.Replace(savedLayoutJSON, "saved source", source, 1)
			path := layoutDatabase17(t, state)
			for range 2 {
				database, err := Open(path)
				if err != nil {
					t.Fatal(err)
				}
				var text, id string
				var revision, commentRevision, count int
				err = database.QueryRowContext(t.Context(), `SELECT r.markdown,d.table_layout_revision_id,d.source_revision_id FROM comment_document d JOIN document_revision r ON r.id=d.table_layout_revision_id AND r.document_id=d.id WHERE d.id=1`).Scan(&text, &revision, &commentRevision)
				if err != nil || text != source || commentRevision != 10 {
					t.Fatalf("revision linkage: %q %d %d %v", text, revision, commentRevision, err)
				}
				if source == "saved source" && revision != 10 {
					t.Fatal("duplicated existing snapshot")
				}
				if err = database.QueryRowContext(t.Context(), `SELECT id FROM markdown_table_layout WHERE document_id=1 AND column_count=3 AND start_line=1 AND end_line=3`).Scan(&id); err != nil || id != "existing-table" {
					t.Fatalf("table identity: %s %v", id, err)
				}
				if err = database.QueryRowContext(t.Context(), `SELECT count(*) FROM markdown_table_column_width WHERE table_id='existing-table' AND ((column_index=0 AND width_px=100) OR (column_index=2 AND width_px=320))`).Scan(&count); err != nil || count != 2 {
					t.Fatalf("widths: %d %v", count, err)
				}
				if err = database.QueryRowContext(t.Context(), `SELECT count(*) FROM markdown_table_column_width WHERE column_index=1`).Scan(&count); err != nil || count != 0 {
					t.Fatal("persisted automatic width")
				}
				if err = database.QueryRowContext(t.Context(), `SELECT count(*) FROM sqlite_schema WHERE name='document_table_layout'`).Scan(&count); err != nil || count != 0 {
					t.Fatal("JSON table retained")
				}
				if err = database.Close(); err != nil {
					t.Fatal(err)
				}
			}
		})
	}
}

func TestNormalizeTableLayoutsRejectsInvalidLegacyDataWithoutLosingIt(t *testing.T) {
	for _, state := range []string{`{}`, `{"markdown":null,"tables":[]}`, strings.Replace(savedLayoutJSON, "100,0,320", "10,0,320", 1), strings.Replace(savedLayoutJSON, `"columnWidths":[100,0,320]`, `"columnWidths":null`, 1), strings.Replace(savedLayoutJSON, `"id":"existing-table",`, "", 1), `{"markdown":"saved source","tables":[{"id":"duplicate","startLine":1,"endLine":2,"columnCount":1,"columnWidths":[]},{"id":"duplicate","startLine":3,"endLine":4,"columnCount":1,"columnWidths":[]}]}`} {
		t.Run(state, func(t *testing.T) {
			path := layoutDatabase17(t, state)
			for range 2 {
				database, err := Open(path)
				if err == nil {
					_ = database.Close()
					t.Fatal("accepted invalid legacy layout")
				}
				if !strings.Contains(err.Error(), "0018") {
					t.Fatalf("missing migration diagnostic: %v", err)
				}
			}
			database, err := sql.Open("sqlite3", path)
			if err != nil {
				t.Fatal(err)
			}
			for _, query := range []string{
				"SELECT count(*) FROM schema_migration WHERE version='0018'",
				"SELECT count(*) FROM sqlite_schema WHERE name IN ('markdown_table_layout','markdown_table_column_width','table_layout_migration_validation')",
				"SELECT count(*) FROM pragma_table_info('comment_document') WHERE name='table_layout_revision_id'",
			} {
				var count int
				if err = database.QueryRowContext(t.Context(), query).Scan(&count); err != nil || count != 0 {
					t.Fatalf("failed migration left schema changes: %d %v", count, err)
				}
			}
			var preserved string
			if err = database.QueryRowContext(t.Context(), `SELECT state FROM document_table_layout WHERE document_id=1`).Scan(&preserved); err != nil || preserved != state {
				t.Fatalf("lost legacy setting: %q %v", preserved, err)
			}
			if _, err = database.ExecContext(t.Context(), `UPDATE document_table_layout SET state=?`, savedLayoutJSON); err != nil {
				t.Fatal(err)
			}
			_ = database.Close()
			database, err = Open(path)
			if err != nil {
				t.Fatal(err)
			}
			_ = database.Close()
			if _, err = os.Stat(path); err != nil {
				t.Fatal(err)
			}
		})
	}
}
