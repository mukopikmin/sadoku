package db

import (
	"path/filepath"
	"testing"
)

func TestUpgradeMergesInstructionsPerScope(t *testing.T) {
	path := filepath.Join(t.TempDir(), "existing.sqlite3")
	database, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	// Recreate the last multi-entry schema, with interleaved IDs and timestamps.
	for _, statement := range []string{
		"DROP INDEX idx_document_instruction_singleton",
		"DROP INDEX idx_global_instruction_singleton",
		"DELETE FROM schema_migration WHERE version='0014'",
		"INSERT INTO comment_document(id,file_path,created_at,updated_at) VALUES(1,'one.md','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z'),(2,'two.md','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')",
		"INSERT INTO document_instruction(id,document_id,content,created_at,updated_at) VALUES(9,1,'Later\nparagraph','2026-01-02T00:00:00.000Z','2026-01-04T00:00:00.000Z'),(3,2,'Other document','2026-01-01T00:00:00.000Z','2026-01-02T00:00:00.000Z'),(2,1,'First 日本語','2026-01-01T00:00:00.000Z','2026-01-03T00:00:00.000Z')",
		"INSERT INTO global_instruction(id,content,created_at,updated_at) VALUES(7,'Shared second','2026-01-02T00:00:00.000Z','2026-01-04T00:00:00.000Z'),(4,'Shared first','2026-01-01T00:00:00.000Z','2026-01-03T00:00:00.000Z')",
		"INSERT INTO document_memory(document_id,content,created_at,updated_at) VALUES(1,'Memory one','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z'),(1,'Memory two','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')",
	} {
		if _, err := database.Exec(statement); err != nil {
			database.Close()
			t.Fatal(err)
		}
	}
	database.Close()
	for range 2 {
		database, err = Open(path)
		if err != nil {
			t.Fatal(err)
		}
		for _, test := range []struct {
			query, content string
			id             int64
		}{
			{"SELECT id,content,created_at,updated_at FROM document_instruction WHERE document_id=1", "First 日本語\n\nLater\nparagraph", 2},
			{"SELECT id,content,created_at,updated_at FROM global_instruction", "Shared first\n\nShared second", 4},
		} {
			var id int64
			var content, created, updated string
			err = database.QueryRow(test.query).Scan(&id, &content, &created, &updated)
			if err != nil || id != test.id || content != test.content || created != "2026-01-01T00:00:00.000Z" || updated != "2026-01-04T00:00:00.000Z" {
				t.Fatalf("merged instruction: %d %q %q %q: %v", id, content, created, updated, err)
			}
		}
		var other string
		if err = database.QueryRow("SELECT content FROM document_instruction WHERE document_id=2").Scan(&other); err != nil || other != "Other document" {
			t.Fatalf("other scope: %q %v", other, err)
		}
		var memories int
		if err = database.QueryRow("SELECT COUNT(*) FROM document_memory WHERE document_id=1").Scan(&memories); err != nil || memories != 2 {
			t.Fatalf("memories: %d %v", memories, err)
		}
		for _, statement := range []string{
			"INSERT INTO document_instruction(document_id,content,created_at,updated_at) VALUES(1,'duplicate','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')",
			"INSERT INTO global_instruction(content,created_at,updated_at) VALUES('duplicate','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')",
		} {
			if _, err := database.Exec(statement); err == nil {
				t.Fatal("accepted multiple instructions")
			}
		}
		if err = database.Close(); err != nil {
			t.Fatal(err)
		}
	}
}
