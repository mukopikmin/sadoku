package db

import (
	"database/sql"
	"reflect"
	"strings"
	"testing"
)

// Exercise the public startup path against a file that the old schema accepts.
// A failed startup must preserve the original database across process restarts.
func TestOpenRetriesLegacyResolutionFailureWithoutRecreatingDatabase(t *testing.T) {
	for _, test := range []struct{ name, assignment string }{
		{"resolved without metadata", "resolved=1"},
		{"resolved without timestamp", "resolved=1,resolved_by_type='human'"},
		{"resolved without resolver", "resolved=1,resolved_at='2026-01-01T00:00:00.000Z'"},
		{"unresolved with timestamp", "resolved_at='2026-01-01T00:00:00.000Z'"},
		{"unresolved with resolver", "resolved_by_type='bot'"},
	} {
		t.Run(test.name, func(t *testing.T) {
			database, path := legacyDatabase(t)
			if _, err := database.ExecContext(t.Context(), "UPDATE comment SET "+test.assignment); err != nil { // #nosec G202 -- Assignments come from fixed test cases, never external input.
				t.Fatal(err)
			}
			beforeSchema := schema(t, database)
			beforeData := migrationData(t, database)
			if err := database.Close(); err != nil {
				t.Fatal(err)
			}
			for range 2 {
				opened, err := Open(path)
				if opened != nil {
					_ = opened.Close()
					t.Fatal("startup accepted inconsistent legacy data")
				}
				if err == nil || !strings.Contains(err.Error(), "migration 0016") {
					t.Fatalf("expected migration 0016 failure: %v", err)
				}
				// Inspect without running migrations, as an operator would.
				raw, err := sql.Open("sqlite3", path)
				if err != nil {
					t.Fatal(err)
				}
				func() {
					defer func() { _ = raw.Close() }()
					if !reflect.DeepEqual(beforeSchema, schema(t, raw)) || !reflect.DeepEqual(beforeData, migrationData(t, raw)) {
						t.Fatal("failed startup changed schema, data, or migration history")
					}
				}()
			}
			// This fixture's original state is known to be unresolved. Restore it;
			// production repairs must instead use trusted historical records.
			raw, err := sql.Open("sqlite3", path)
			if err != nil {
				t.Fatal(err)
			}
			_, err = raw.ExecContext(t.Context(), "UPDATE comment SET resolved=0,resolved_at=NULL,resolved_by_type=NULL")
			if err != nil {
				_ = raw.Close()
				t.Fatal(err)
			}
			repairedData := migrationData(t, raw)
			_ = raw.Close()
			var upgradedData map[string][][]any
			for range 2 {
				opened, err := Open(path)
				if err != nil {
					t.Fatal(err)
				}
				func() {
					defer func() { _ = opened.Close() }()
					data := migrationData(t, opened)
					if upgradedData == nil {
						upgradedData = data
						for _, table := range []string{"comment_document", "comment", "comment_reply"} {
							if !reflect.DeepEqual(data[table], repairedData[table]) {
								t.Fatalf("retry changed repaired %s data", table)
							}
						}
						if len(data["schema_migration"]) != 18 || !reflect.DeepEqual(data["comment_reply"], beforeData["comment_reply"]) {
							t.Fatal("retry lost replies or did not apply all migrations")
						}
					} else if !reflect.DeepEqual(upgradedData, data) {
						t.Fatal("reopening changed upgraded data or migration history")
					}
				}()
			}
		})
	}
}

func migrationData(t *testing.T, database *sql.DB) map[string][][]any {
	t.Helper()
	result := make(map[string][][]any)
	for _, table := range []string{"comment_document", "comment", "comment_reply", "schema_migration"} {
		func() {
			rows, err := database.QueryContext(t.Context(), "SELECT * FROM "+table+" ORDER BY 1") // #nosec G202 -- Table names come from the fixed internal allowlist above.
			if err != nil {
				t.Fatal(err)
			}
			defer func() { _ = rows.Close() }()
			columns, err := rows.Columns()
			if err != nil {
				t.Fatal(err)
			}
			for rows.Next() {
				values := make([]any, len(columns))
				pointers := make([]any, len(columns))
				for i := range values {
					pointers[i] = &values[i]
				}
				if err := rows.Scan(pointers...); err != nil {
					t.Fatal(err)
				}
				// New nullable layout reference is absent in the legacy fixture.
				if table == "comment_document" && columns[len(columns)-1] != "table_layout_revision_id" {
					values = append(values, nil)
				}
				result[table] = append(result[table], values)
			}
			if err := rows.Err(); err != nil {
				t.Fatal(err)
			}
		}()
	}
	return result
}
