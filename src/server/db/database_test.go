package db

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
)

func TestMigrationCompatibility(t *testing.T) {
	path := filepath.Join(t.TempDir(), "app.sqlite3")
	database, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	var count int
	if err = database.QueryRow("SELECT COUNT(*) FROM schema_migration WHERE state='applied'").Scan(&count); err != nil || count != 12 {
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
	for _, table := range []string{"comment_reply", "comment", "document_tag_link", "document_tag", "document_memory", "document_instruction", "comment_document", "document_revision", "schema_migration"} {
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
