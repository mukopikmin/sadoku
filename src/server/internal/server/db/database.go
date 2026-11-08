// Package db opens the application database shared with earlier Sadoku versions.
package db

import (
	"context"
	"database/sql"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed migrations/legacy.json
var legacy []byte

//go:embed migrations/current.json
var current []byte

type migration struct {
	Version, Name, Checksum string
	Statements              []string
	Rebuild                 bool
}

func Now() string { return time.Now().UTC().Format("2006-01-02T15:04:05.000Z") }

func Open(path string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	uriPath := filepath.ToSlash(absolute)
	if !strings.HasPrefix(uriPath, "/") {
		uriPath = "/" + uriPath
	}
	// URI parameters configure every connection, including replacements created
	// by database/sql. Escape the path so filenames containing ? or # stay literal.
	uri := url.URL{Scheme: "file", Path: uriPath, RawQuery: "_foreign_keys=on&_busy_timeout=5000"}
	database, err := sql.Open("sqlite3", uri.String())
	if err != nil {
		return nil, err
	}
	database.SetMaxOpenConns(1)
	err = Migrate(database)
	if err != nil {
		_ = database.Close()
		return nil, err
	}
	return database, nil
}

func Migrate(database *sql.DB) error {
	_, err := database.Exec(`CREATE TABLE IF NOT EXISTS schema_migration (
		version TEXT PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL,
		state TEXT NOT NULL CHECK(state IN ('running','applied','failed')),
		started_at TEXT NOT NULL CHECK(started_at GLOB '????-??-??T??:??:??.???Z'),
		finished_at TEXT CHECK(finished_at IS NULL OR finished_at GLOB '????-??-??T??:??:??.???Z'), error_message TEXT)`)
	if err != nil {
		return err
	}
	var migrations []migration
	if err := json.Unmarshal(legacy, &migrations); err != nil {
		return err
	}
	var additions []migration
	if err := json.Unmarshal(current, &additions); err != nil {
		return err
	}
	migrations = append(migrations, additions...)
	known := map[string]migration{}
	for _, m := range migrations {
		known[m.Version] = m
	}
	rows, err := database.Query("SELECT version, checksum, state FROM schema_migration")
	if err != nil {
		return err
	}
	defer func() { _ = rows.Close() }()
	applied := map[string]bool{}
	for rows.Next() {
		var version, checksum, state string
		if err = rows.Scan(&version, &checksum, &state); err != nil {
			break
		}
		m, ok := known[version]
		if !ok || state != "applied" || checksum != m.Checksum {
			err = fmt.Errorf("database migration %s has unknown version, state, or checksum; resolve the migration before continuing", version)
			break
		}
		applied[version] = true
	}
	if err == nil {
		err = rows.Err()
	}
	_ = rows.Close()
	if err != nil {
		return err
	}
	var pending []migration
	for _, m := range migrations {
		if !applied[m.Version] {
			pending = append(pending, m)
		}
	}
	if len(pending) == 0 {
		return nil
	}
	// Commit pending migrations together to avoid a disk sync per version.
	// A failed upgrade rolls back both schema changes and migration records.
	return applyMigrations(database, pending)
}

func applyMigration(database *sql.DB, m migration) error {
	return applyMigrations(database, []migration{m})
}

// Rebuilds must disable foreign keys before BEGIN on the same pinned connection.
// Otherwise dropping a parent table can cascade into its children.
func applyMigrations(database *sql.DB, migrations []migration) (result error) {
	rebuild := false
	for _, m := range migrations {
		rebuild = rebuild || m.Rebuild
	}
	ctx := context.Background()
	conn, err := database.Conn(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = conn.Close() }()
	if rebuild {
		var enabled int
		if err := conn.QueryRowContext(ctx, "PRAGMA foreign_keys").Scan(&enabled); err != nil {
			return err
		}
		if _, err := conn.ExecContext(ctx, "PRAGMA foreign_keys=OFF"); err != nil {
			return err
		}
		defer func() {
			_, err := conn.ExecContext(ctx, fmt.Sprintf("PRAGMA foreign_keys=%d", enabled))
			result = errors.Join(result, err)
		}()
	}
	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	for _, m := range migrations {
		for _, statement := range m.Statements {
			if _, err := tx.Exec(statement); err != nil {
				return fmt.Errorf("migration %s: %w", m.Version, err)
			}
		}
		if _, err := tx.Exec("INSERT INTO schema_migration VALUES (?, ?, ?, 'applied', ?, ?, NULL)", m.Version, m.Name, m.Checksum, Now(), Now()); err != nil {
			return fmt.Errorf("migration %s: %w", m.Version, err)
		}
	}
	if rebuild {
		rows, err := tx.Query("PRAGMA foreign_key_check")
		if err != nil {
			return err
		}
		defer func() { _ = rows.Close() }()
		invalid := rows.Next()
		err = rows.Err()
		_ = rows.Close()
		if err != nil {
			return err
		}
		if invalid {
			return fmt.Errorf("foreign key violations after table rebuild")
		}
	}
	return tx.Commit()
}
