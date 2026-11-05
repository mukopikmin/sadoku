package storage

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/mukopikmin/sadoku/internal/server/db"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func (r *Repository) RegisterDocument(path string, title **string, tags *[]int64) (u.Document, error) {
	return r.saveDocumentAttributes(0, path, title, tags)
}

// Omitted attributes are preserved, and all specified attributes commit together.
func (r *Repository) UpdateDocumentAttributes(id int64, title **string, tags *[]int64) (u.Document, error) {
	return r.saveDocumentAttributes(id, "", title, tags)
}

func (r *Repository) saveDocumentAttributes(id int64, path string, title **string, tags *[]int64) (u.Document, error) {
	var doc u.Document
	tx, err := r.DB.Begin()
	if err != nil {
		return doc, err
	}
	defer tx.Rollback()
	if id == 0 {
		var existing int64
		err = tx.QueryRow("SELECT id FROM comment_document WHERE file_path=?", path).Scan(&existing)
		if err == nil {
			return doc, fmt.Errorf("Document is already registered: %d. Use `sadoku document update %d` to change its attributes.", existing, existing)
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return doc, err
		}
		now := db.Now()
		result, err := tx.Exec("INSERT INTO comment_document(file_path,created_at,updated_at) VALUES(?,?,?)", path, now, now)
		if err != nil {
			return doc, err
		}
		id, err = result.LastInsertId()
		if err != nil {
			return doc, err
		}
	}
	err = tx.QueryRow("SELECT id,file_path,title FROM comment_document WHERE id=?", id).Scan(&doc.ID, &doc.FilePath, &doc.DisplayTitle)
	if errors.Is(err, sql.ErrNoRows) {
		return doc, fmt.Errorf("Document not found: %d", id)
	}
	if err != nil {
		return doc, err
	}
	if title != nil {
		doc.DisplayTitle = *title
		if _, err = tx.Exec("UPDATE comment_document SET title=?,updated_at=? WHERE id=?", *title, db.Now(), id); err != nil {
			return doc, err
		}
	}
	if tags != nil {
		for _, tagID := range *tags {
			var found int64
			err = tx.QueryRow("SELECT id FROM document_tag WHERE id=?", tagID).Scan(&found)
			if errors.Is(err, sql.ErrNoRows) {
				return doc, fmt.Errorf("Tag %d not found.", tagID)
			}
			if err != nil {
				return doc, err
			}
		}
		if _, err = tx.Exec("DELETE FROM document_tag_link WHERE document_id=?", id); err != nil {
			return doc, err
		}
		for _, tagID := range *tags {
			if _, err = tx.Exec("INSERT INTO document_tag_link(document_id,tag_id) VALUES(?,?) ON CONFLICT DO NOTHING", id, tagID); err != nil {
				return doc, err
			}
		}
	}
	if err = tx.Commit(); err != nil {
		return doc, err
	}
	doc.Tags, err = r.Tags(id)
	return doc, err
}
