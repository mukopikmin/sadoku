package db

import (
	"database/sql"
	"encoding/json"
	u "github.com/mukopikmin/sadoku/src/internal/server/usecase"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func legacyDatabase(t *testing.T) (*sql.DB, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "legacy.sqlite3")
	database, err := sql.Open("sqlite3", "file:"+path+"?_foreign_keys=on")
	if err != nil {
		t.Fatal(err)
	}
	database.SetMaxOpenConns(1)
	t.Cleanup(func() { database.Close() })
	var migrations []migration
	if err := json.Unmarshal(legacy, &migrations); err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`CREATE TABLE schema_migration(version TEXT PRIMARY KEY,name TEXT NOT NULL,checksum TEXT NOT NULL,state TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,error_message TEXT)`); err != nil {
		t.Fatal(err)
	}
	for _, m := range migrations {
		if err := applyMigration(database, m); err != nil {
			t.Fatal(err)
		}
	}
	for _, statement := range []string{
		`INSERT INTO comment_document(id,file_path,created_at,updated_at) VALUES(1,'doc.md','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')`,
		`INSERT INTO comment(id,document_id,local_id,start_line,end_line,original_start_line,original_end_line,body,created_at,updated_at,source_text,source_hash) VALUES(7,1,1,1,1,1,1,'review','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z','original','hash')`,
		`INSERT INTO comment_reply(id,comment_id,local_id,body,created_at,updated_at) VALUES(9,7,1,'reply','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')`,
	} {
		if _, err := database.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	return database, path
}

func schema(t *testing.T, database *sql.DB) []string {
	t.Helper()
	rows, err := database.Query(`SELECT type||':'||name||':'||sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	result := []string{}
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			t.Fatal(err)
		}
		result = append(result, value)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestRebuildPreservesDataAndMatchesFreshSchema(t *testing.T) {
	database, path := legacyDatabase(t)
	if err := Migrate(database); err != nil {
		t.Fatal(err)
	}
	fresh, err := Open(filepath.Join(t.TempDir(), "fresh.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	defer fresh.Close()
	if !reflect.DeepEqual(schema(t, database), schema(t, fresh)) {
		t.Fatal("fresh and upgraded schemas differ")
	}
	for range 2 {
		if err := Migrate(database); err != nil {
			t.Fatal(err)
		}
		var body string
		if err := database.QueryRow(`SELECT r.body FROM comment_reply r JOIN comment c ON c.id=r.comment_id WHERE c.id=7 AND r.id=9`).Scan(&body); err != nil || body != "reply" {
			t.Fatalf("lost reply: %q %v", body, err)
		}
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	for _, statement := range []string{
		`UPDATE comment SET source_text=NULL`, `UPDATE comment SET source_hash=NULL`,
		`UPDATE comment SET resolved=1`,
		`UPDATE comment SET resolved_at='2026-01-01T00:00:00.000Z'`,
		`UPDATE comment SET resolved_by_type='bot'`,
		`UPDATE schema_migration SET version=NULL`,
		`INSERT INTO comment_reply(comment_id,local_id,body,created_at,updated_at) VALUES(999,1,'orphan','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')`,
	} {
		if _, err := reopened.Exec(statement); err == nil {
			t.Fatalf("accepted invalid data: %s", statement)
		}
	}
	if _, err := reopened.Exec(`UPDATE comment SET resolved=1,resolved_at='2026-01-01T00:00:00.000Z',resolved_by_type='bot'`); err != nil {
		t.Fatal(err)
	}
	if _, err := reopened.Exec(`DELETE FROM comment WHERE id=7`); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := reopened.QueryRow(`SELECT count(*) FROM comment_reply`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("cascade: %d %v", count, err)
	}
}

func TestRebuildFailureRollsBackAndCanRetry(t *testing.T) {
	for _, invalid := range []string{`resolved=1`, `resolved_by_type='bot'`} {
		t.Run(invalid, func(t *testing.T) {
			database, _ := legacyDatabase(t)
			if _, err := database.Exec("UPDATE comment SET " + invalid); err != nil {
				t.Fatal(err)
			}
			err := Migrate(database)
			if err == nil || !strings.Contains(err.Error(), "migration 0016") {
				t.Fatalf("expected actionable migration error: %v", err)
			}
			var enabled, count int
			if err := database.QueryRow("PRAGMA foreign_keys").Scan(&enabled); err != nil || enabled != 1 {
				t.Fatalf("foreign keys: %d %v", enabled, err)
			}
			if err := database.QueryRow("SELECT count(*) FROM comment_reply WHERE id=9 AND comment_id=7").Scan(&count); err != nil || count != 1 {
				t.Fatalf("lost data: %d %v", count, err)
			}
			if err := database.QueryRow("SELECT count(*) FROM sqlite_schema WHERE name='comment_new'").Scan(&count); err != nil || count != 0 {
				t.Fatalf("temporary table survived: %d %v", count, err)
			}
			if err := database.QueryRow("SELECT count(*) FROM schema_migration WHERE version='0016'").Scan(&count); err != nil || count != 0 {
				t.Fatalf("failed migration recorded: %d %v", count, err)
			}
			if _, err := database.Exec(`UPDATE comment SET source_text='original',source_hash='hash',resolved=0,resolved_at=NULL,resolved_by_type=NULL`); err != nil {
				t.Fatal(err)
			}
			if err := Migrate(database); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestRebuildRejectsForeignKeyViolations(t *testing.T) {
	database, _ := legacyDatabase(t)
	err := applyMigration(database, migration{Version: "test", Rebuild: true, Statements: []string{`UPDATE comment_reply SET comment_id=999`}})
	if err == nil || !strings.Contains(err.Error(), "foreign key violations") {
		t.Fatalf("unexpected error: %v", err)
	}
	var parent int
	if err := database.QueryRow("SELECT comment_id FROM comment_reply WHERE id=9").Scan(&parent); err != nil || parent != 7 {
		t.Fatalf("failed rebuild changed data: %d %v", parent, err)
	}
}

func TestRebuildFillsOnlyMissingSourceValues(t *testing.T) {
	for _, test := range []struct{ name, assignment, text, hash string }{
		{"both missing", "source_text=NULL,source_hash=NULL", "", ""},
		{"text missing", "source_text=NULL", "", "hash"},
		{"hash missing", "source_hash=NULL", "original", ""},
		{"present", "source_text='original'", "original", "hash"},
		{"real empty text", "source_text='',source_hash='811c9dc5'", "", "811c9dc5"},
	} {
		t.Run(test.name, func(t *testing.T) {
			database, _ := legacyDatabase(t)
			if _, err := database.Exec("UPDATE comment SET " + test.assignment); err != nil {
				t.Fatal(err)
			}
			for range 2 {
				if err := Migrate(database); err != nil {
					t.Fatal(err)
				}
				var text, hash string
				if err := database.QueryRow("SELECT source_text,source_hash FROM comment WHERE id=7").Scan(&text, &hash); err != nil {
					t.Fatal(err)
				}
				if text != test.text || hash != test.hash {
					t.Fatalf("source values: %q %q", text, hash)
				}
				if hash == "" {
					doc := u.ResolveComments(u.Comments{Comments: []u.Comment{{StartLine: 1, EndLine: 1, SourceText: &text, SourceHash: &hash}}}, "\noriginal")
					if !doc.Comments[0].Stale {
						t.Fatal("placeholder matched a source line")
					}
				}
			}
		})
	}
}
