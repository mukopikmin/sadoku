package db

import (
	"compress/gzip"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
)

func TestOpenPreservesLiteralDatabasePaths(t *testing.T) {
	names := []string{"comments # % 日本語.sqlite3"}
	if runtime.GOOS != "windows" {
		names = append(names, "comments ? query.sqlite3")
	}
	t.Chdir(t.TempDir())
	for _, name := range names {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join("nested", name)
			database, err := Open(path)
			if err != nil {
				t.Fatal(err)
			}
			if err = database.Close(); err != nil {
				t.Fatal(err)
			}
			if _, err = os.Stat(path); err != nil {
				t.Fatalf("database was not created at its literal path: %v", err)
			}
			database, err = Open(path)
			if err != nil {
				t.Fatal(err)
			}
			defer database.Close()
			var count int
			if err = database.QueryRow("SELECT COUNT(*) FROM schema_migration").Scan(&count); err != nil || count != 13 {
				t.Fatalf("reopened database migrations: %d, %v", count, err)
			}
		})
	}
}

func TestReplacementConnectionsPreserveConstraints(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "app.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	// Force each operation to use a new connection instead of the one that ran
	// migrations. Foreign keys and busy handling must survive pool replacement.
	database.SetMaxIdleConns(0)
	var timeout int
	if err = database.QueryRow("PRAGMA busy_timeout").Scan(&timeout); err != nil || timeout != 5000 {
		t.Fatalf("replacement connection busy timeout: %d, %v", timeout, err)
	}
	if _, err = database.Exec("INSERT INTO document_instruction(document_id,content,created_at,updated_at) VALUES(999,'orphan',?,?)", Now(), Now()); err == nil {
		t.Fatal("replacement connection accepted an orphan instruction")
	}
	if _, err = database.Exec("INSERT INTO comment_document(id,file_path,created_at,updated_at) VALUES(1,'doc.md',?,?)", Now(), Now()); err != nil {
		t.Fatal(err)
	}
	if _, err = database.Exec("INSERT INTO document_instruction(document_id,content,created_at,updated_at) VALUES(1,'instruction',?,?)", Now(), Now()); err != nil {
		t.Fatal(err)
	}
	if _, err = database.Exec("DELETE FROM comment_document WHERE id=1"); err != nil {
		t.Fatal(err)
	}
	var count int
	if err = database.QueryRow("SELECT COUNT(*) FROM document_instruction").Scan(&count); err != nil || count != 0 {
		t.Fatalf("replacement connection did not cascade deletion: %d, %v", count, err)
	}
}

func TestOpenDatabaseWrittenByWasmDriver(t *testing.T) {
	fixture, err := os.Open("testdata/wasm.sqlite3.gz")
	if err != nil {
		t.Fatal(err)
	}
	defer fixture.Close()
	reader, err := gzip.NewReader(fixture)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "legacy.sqlite3")
	if err = os.WriteFile(path, data, 0600); err != nil {
		t.Fatal(err)
	}
	for attempt := range 2 {
		database, err := Open(path)
		if err != nil {
			t.Fatal(err)
		}
		defer database.Close()
		var count int
		if err = database.QueryRow("SELECT COUNT(*) FROM schema_migration WHERE state='applied'").Scan(&count); err != nil || count != 13 {
			t.Fatalf("legacy migrations: %d, %v", count, err)
		}
		want := []string{"legacy.md", "WASM 文書", "既存のコメント", "返信", "# 保存済み", "指示", "メモリー", "タグ"}
		if attempt == 1 {
			want[2] = "CGO で更新"
		}
		got := make([]string, len(want))
		dest := make([]any, len(got))
		for i := range got {
			dest[i] = &got[i]
		}
		err = database.QueryRow(`SELECT d.file_path,d.title,c.body,r.body,v.markdown,i.content,m.content,t.name
			FROM comment_document d
			JOIN comment c ON c.document_id=d.id
			JOIN comment_reply r ON r.comment_id=c.id
			JOIN document_revision v ON v.id=d.source_revision_id
			JOIN document_instruction i ON i.document_id=d.id
			JOIN document_memory m ON m.document_id=d.id
			JOIN document_tag_link l ON l.document_id=d.id
			JOIN document_tag t ON t.id=l.tag_id`).Scan(dest...)
		if err != nil || !reflect.DeepEqual(got, want) {
			t.Fatalf("legacy data: %q, %v; want %q", got, err, want)
		}
		if _, err = database.Exec("UPDATE comment SET body='CGO で更新' WHERE id=1"); err != nil {
			t.Fatal(err)
		}
		var integrity string
		if err = database.QueryRow("PRAGMA integrity_check").Scan(&integrity); err != nil || integrity != "ok" {
			t.Fatalf("legacy database integrity: %q, %v", integrity, err)
		}
		if err = database.Close(); err != nil {
			t.Fatal(err)
		}
	}
}

func TestMigrationCompatibility(t *testing.T) {
	path := filepath.Join(t.TempDir(), "app.sqlite3")
	database, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	var count int
	if err = database.QueryRow("SELECT COUNT(*) FROM schema_migration WHERE state='applied'").Scan(&count); err != nil || count != 13 {
		t.Fatalf("migration count %d: %v", count, err)
	}
	_, err = database.Exec("INSERT INTO comment_document(file_path,created_at,updated_at,title) VALUES('old.md',?,?,'Old title')", Now(), Now())
	if err != nil {
		t.Fatal(err)
	}
	database.Close()
	database, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	var title string
	if err = database.QueryRow("SELECT title FROM comment_document").Scan(&title); err != nil || title != "Old title" {
		t.Fatalf("lost existing document: %q %v", title, err)
	}
	if _, err = database.Exec("UPDATE schema_migration SET checksum='changed' WHERE version='0001'"); err != nil {
		t.Fatal(err)
	}
	if err = Migrate(database); err == nil {
		t.Fatal("accepted edited migration")
	}
}

func TestOriginalMigrationsRetainTheirChecksums(t *testing.T) {
	var migrations []migration
	if err := json.Unmarshal(legacy, &migrations); err != nil {
		t.Fatal(err)
	}
	for _, m := range migrations {
		source := strings.Join(m.Statements, ";\n")
		// Version 0007 originally hashed this explicit description rather than
		// its executable statements. Keep that historical checksum verbatim.
		if m.Version == "0007" {
			source = `CREATE TABLE document_tag (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'), updated_at TEXT NOT NULL CHECK (updated_at GLOB '????-??-??T??:??:??.???Z')); CREATE TABLE document_tag_link (document_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (document_id, tag_id));`
		}
		actual := fmt.Sprintf("sha256:%x", sha256.Sum256([]byte(source)))
		if actual != m.Checksum {
			t.Errorf("migration %s changed: %s != %s", m.Version, actual, m.Checksum)
		}
	}
}

func TestUpgradeAddsGlobalInstructionsWithoutMovingDocumentContext(t *testing.T) {
	path := filepath.Join(t.TempDir(), "existing.sqlite3")
	database, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	// Reproduce the schema and ledger immediately before global instructions.
	for _, statement := range []string{
		"DROP TABLE global_instruction",
		"DELETE FROM schema_migration WHERE version='0013'",
		"INSERT INTO comment_document(id,file_path,created_at,updated_at) VALUES(1,'doc.md','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')",
		"INSERT INTO document_instruction(document_id,content,created_at,updated_at) VALUES(1,'Local instruction','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')",
		"INSERT INTO document_memory(document_id,content,created_at,updated_at) VALUES(1,'Local memory','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')",
	} {
		if _, err := database.Exec(statement); err != nil {
			database.Close()
			t.Fatal(err)
		}
	}
	database.Close()
	database, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	for table, expected := range map[string]string{"document_instruction": "Local instruction", "document_memory": "Local memory"} {
		var content string
		if err := database.QueryRow("SELECT content FROM " + table + " WHERE document_id=1").Scan(&content); err != nil || content != expected {
			t.Fatalf("%s: %q %v", table, content, err)
		}
	}
	var count int
	if err := database.QueryRow("SELECT COUNT(*) FROM global_instruction").Scan(&count); err != nil || count != 0 {
		t.Fatalf("global instructions: %d %v", count, err)
	}
}

func TestMigrationLedgerRejectsInterruptedOrUnknownHistory(t *testing.T) {
	for _, test := range []struct{ name, statement string }{
		{"failed", `UPDATE schema_migration SET state='failed' WHERE version='0001'`},
		{"running", `UPDATE schema_migration SET state='running' WHERE version='0001'`},
		{"unknown", `UPDATE schema_migration SET version='9999' WHERE version='0001'`},
	} {
		t.Run(test.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "app.sqlite3")
			database, err := Open(path)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = database.Exec(test.statement); err != nil {
				database.Close()
				t.Fatal(err)
			}
			database.Close()
			if reopened, err := Open(path); err == nil {
				reopened.Close()
				t.Fatal("opened a database with invalid migration history")
			}
		})
	}
}
func TestUpgradeLegacySnapshots(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "old.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	// Recreate a pre-0012 database using the original, immutable statements.
	for _, table := range []string{"global_instruction", "comment_reply", "comment", "document_tag_link", "document_tag", "document_memory", "document_instruction", "comment_document", "document_revision", "schema_migration"} {
		if _, err = database.Exec("DROP TABLE " + table); err != nil {
			t.Fatal(err)
		}
	}
	var migrations []migration
	if err = json.Unmarshal(legacy, &migrations); err != nil {
		t.Fatal(err)
	}
	for _, m := range migrations[:11] {
		for _, statement := range m.Statements {
			if _, err = database.Exec(statement); err != nil {
				t.Fatal(err)
			}
		}
	}
	_, err = database.Exec("INSERT INTO comment_document(file_path,created_at,updated_at,source_snapshot,previous_source_snapshot) VALUES('old.md',?,?,'new','old')", Now(), Now())
	if err != nil {
		t.Fatal(err)
	}
	_, err = database.Exec(`CREATE TABLE schema_migration(version TEXT PRIMARY KEY,name TEXT,checksum TEXT,state TEXT,started_at TEXT,finished_at TEXT,error_message TEXT)`)
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range migrations[:11] {
		if _, err = database.Exec("INSERT INTO schema_migration VALUES(?,?,?,'applied',?,?,NULL)", m.Version, m.Name, m.Checksum, Now(), Now()); err != nil {
			t.Fatal(err)
		}
	}
	if err = Migrate(database); err != nil {
		t.Fatal(err)
	}
	var current, previous string
	err = database.QueryRow(`SELECT (SELECT markdown FROM document_revision WHERE id=source_revision_id),(SELECT markdown FROM document_revision WHERE id=previous_source_revision_id) FROM comment_document`).Scan(&current, &previous)
	if err != nil || current != "new" || previous != "old" {
		t.Fatalf("snapshots: %q %q %v", current, previous, err)
	}
}
