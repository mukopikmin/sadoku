package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/mukopikmin/sadoku/internal/server/db"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

type Repository struct {
	DB   *sql.DB
	Path string
}

func (r *Repository) FindDocument(ctx context.Context, path string) (u.Document, bool, error) {
	var document u.Document
	err := r.DB.QueryRowContext(ctx, "SELECT id,file_path,title FROM comment_document WHERE file_path=?", path).Scan(&document.ID, &document.FilePath, &document.DisplayTitle)
	if errors.Is(err, sql.ErrNoRows) {
		return document, false, nil
	}
	return document, err == nil, err
}

func (r *Repository) Ensure(ctx context.Context, path string) (u.Document, error) {
	now := db.Now()
	_, err := r.DB.ExecContext(ctx, "INSERT INTO comment_document(file_path,created_at,updated_at) VALUES(?,?,?) ON CONFLICT(file_path) DO NOTHING", path, now, now)
	if err != nil {
		return u.Document{}, err
	}
	var d u.Document
	err = r.DB.QueryRowContext(ctx, "SELECT id,file_path,title FROM comment_document WHERE file_path=?", path).Scan(&d.ID, &d.FilePath, &d.DisplayTitle)
	return d, err
}
func (r *Repository) EnsureMany(ctx context.Context, paths []string) ([]u.Document, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	documents := []u.Document{}
	now := db.Now()
	for _, path := range paths {
		if _, err = tx.ExecContext(ctx, "INSERT INTO comment_document(file_path,created_at,updated_at) VALUES(?,?,?) ON CONFLICT(file_path) DO NOTHING", path, now, now); err != nil {
			return nil, err
		}
		var d u.Document
		if err = tx.QueryRowContext(ctx, "SELECT id,file_path,title FROM comment_document WHERE file_path=?", path).Scan(&d.ID, &d.FilePath, &d.DisplayTitle); err != nil {
			return nil, err
		}
		documents = append(documents, d)
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return documents, nil
}

func (r *Repository) Documents(ctx context.Context) ([]u.Document, error) {
	rows, err := r.DB.QueryContext(ctx, "SELECT id,file_path,title FROM comment_document ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	docs := []u.Document{}
	for rows.Next() {
		var d u.Document
		if err = rows.Scan(&d.ID, &d.FilePath, &d.DisplayTitle); err != nil {
			return nil, err
		}
		docs = append(docs, d)
	}
	return docs, rows.Err()
}
func (r *Repository) SetTitle(ctx context.Context, id int64, title *string) error {
	_, err := r.DB.ExecContext(ctx, "UPDATE comment_document SET title=?,updated_at=? WHERE id=?", title, db.Now(), id)
	return err
}
func (r *Repository) Snapshot(ctx context.Context, id int64) (*string, *string, error) {
	var current, previous *string
	err := r.DB.QueryRowContext(ctx, `SELECT (SELECT markdown FROM document_revision WHERE id=d.source_revision_id),(SELECT markdown FROM document_revision WHERE id=d.previous_source_revision_id) FROM comment_document d WHERE id=?`, id).Scan(&current, &previous)
	return current, previous, err
}
func (r *Repository) Revisions(ctx context.Context, id int64) ([]u.Revision, error) {
	rows, err := r.DB.QueryContext(ctx, "SELECT id,recorded_at FROM document_revision WHERE document_id=? ORDER BY id DESC LIMIT 20", id)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	list := []u.Revision{}
	for rows.Next() {
		var rev u.Revision
		if err = rows.Scan(&rev.ID, &rev.RecordedAt); err != nil {
			return nil, err
		}
		list = append(list, rev)
	}
	return list, rows.Err()
}
func (r *Repository) Revision(ctx context.Context, id, revID int64) (u.Revision, error) {
	var rev u.Revision
	err := r.DB.QueryRowContext(ctx, `SELECT id,recorded_at,markdown,(SELECT markdown FROM document_revision p WHERE p.document_id=r.document_id AND p.id<r.id ORDER BY p.id DESC LIMIT 1) FROM document_revision r WHERE document_id=? AND id=?`, id, revID).Scan(&rev.ID, &rev.RecordedAt, &rev.Markdown, &rev.PreviousMarkdown)
	if errors.Is(err, sql.ErrNoRows) {
		err = u.Fail("not_found", "Document revision not found.")
	}
	return rev, err
}
func record(ctx context.Context, tx *sql.Tx, id int64, markdown string) (int64, error) {
	res, err := tx.ExecContext(ctx, "INSERT INTO document_revision(document_id,markdown) VALUES(?,?)", id, markdown)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}
func (r *Repository) RecordRevision(ctx context.Context, id int64, markdown string) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	var previous string
	err = tx.QueryRowContext(ctx, "SELECT markdown FROM document_revision WHERE document_id=? ORDER BY id DESC LIMIT 1", id).Scan(&previous)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if err != nil || previous != markdown {
		if _, err = record(ctx, tx, id, markdown); err != nil {
			return err
		}
	}
	return tx.Commit()
}
func (r *Repository) InitializeSnapshot(ctx context.Context, id int64, markdown string) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	var revID *int64
	if err = tx.QueryRowContext(ctx, "SELECT source_revision_id FROM comment_document WHERE id=?", id).Scan(&revID); err != nil {
		return err
	}
	if revID == nil {
		result, err := tx.ExecContext(ctx, "INSERT INTO document_revision(document_id,markdown) VALUES(?,?)", id, markdown)
		if err != nil {
			return err
		}
		id2, err := result.LastInsertId()
		if err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, "UPDATE comment_document SET source_revision_id=? WHERE id=?", id2, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}
func (r *Repository) ReadComments(ctx context.Context, id int64) (u.Comments, error) {
	doc := u.Comments{Comments: []u.Comment{}}
	if err := r.DB.QueryRowContext(ctx, "SELECT file_path FROM comment_document WHERE id=?", id).Scan(&doc.FilePath); err != nil {
		return doc, err
	}
	var err error
	doc.SourceSnapshot, doc.PreviousSourceSnapshot, err = r.Snapshot(ctx, id)
	if err != nil {
		return doc, err
	}
	rows, err := r.DB.QueryContext(ctx, `SELECT id,local_id,body,author_type,start_line,end_line,original_start_line,original_end_line,created_at,updated_at,resolved,stale,resolved_at,resolved_by_type,source_hash,source_text,source_deleted FROM comment WHERE document_id=? ORDER BY local_id`, id)
	if err != nil {
		return doc, err
	}
	defer func() { _ = rows.Close() }()
	ids := []int64{}
	for rows.Next() {
		var c u.Comment
		var internal int64
		var resolver *string
		err = rows.Scan(&internal, &c.ID, &c.Body, &c.Author.Type, &c.StartLine, &c.EndLine, &c.OriginalStartLine, &c.OriginalEndLine, &c.CreatedAt, &c.UpdatedAt, &c.Resolved, &c.Stale, &c.ResolvedAt, &resolver, &c.SourceHash, &c.SourceText, &c.SourceDeleted)
		if err != nil {
			return doc, err
		}
		if resolver != nil {
			c.ResolvedBy = &u.Author{Type: *resolver}
		}
		c.Replies = []u.Reply{}
		ids = append(ids, internal)
		doc.Comments = append(doc.Comments, c)
	}
	err = rows.Err()
	_ = rows.Close()
	if err != nil {
		return doc, err
	}
	for i, internal := range ids {
		if err := func() error {
			replies, err := r.DB.QueryContext(ctx, "SELECT local_id,body,author_type,created_at,updated_at,review_requested FROM comment_reply WHERE comment_id=? ORDER BY local_id", internal)
			if err != nil {
				return err
			}
			defer func() { _ = replies.Close() }()
			for replies.Next() {
				var reply u.Reply
				if err := replies.Scan(&reply.ID, &reply.Body, &reply.Author.Type, &reply.CreatedAt, &reply.UpdatedAt, &reply.ReviewRequested); err != nil {
					return err
				}
				doc.Comments[i].Replies = append(doc.Comments[i].Replies, reply)
			}
			return replies.Err()
		}(); err != nil {
			return doc, err
		}
	}
	return doc, nil
}
func (r *Repository) SaveComments(ctx context.Context, id int64, doc u.Comments) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	var source string
	var old *string
	var currentID *int64
	if err = tx.QueryRowContext(ctx, "SELECT file_path,source_revision_id,(SELECT markdown FROM document_revision WHERE id=source_revision_id) FROM comment_document WHERE id=?", id).Scan(&source, &currentID, &old); err != nil {
		return err
	}
	if doc.SourceSnapshot != nil && (old == nil || *old != *doc.SourceSnapshot) {
		revID, e := record(ctx, tx, id, *doc.SourceSnapshot)
		if e != nil {
			return e
		}
		if _, err = tx.ExecContext(ctx, "UPDATE comment_document SET previous_source_revision_id=source_revision_id,source_revision_id=? WHERE id=?", revID, id); err != nil {
			return err
		}
	}
	if _, err = tx.ExecContext(ctx, "DELETE FROM comment WHERE document_id=?", id); err != nil {
		return err
	}
	for _, c := range doc.Comments {
		var resolver *string
		if c.ResolvedBy != nil {
			resolver = &c.ResolvedBy.Type
		}
		res, e := tx.ExecContext(ctx, `INSERT INTO comment(document_id,local_id,body,author_type,start_line,end_line,original_start_line,original_end_line,created_at,updated_at,resolved,stale,resolved_at,resolved_by_type,source_hash,source_text,source_deleted) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, c.ID, c.Body, c.Author.Type, c.StartLine, c.EndLine, c.OriginalStartLine, c.OriginalEndLine, c.CreatedAt, c.UpdatedAt, c.Resolved, c.Stale, c.ResolvedAt, resolver, c.SourceHash, c.SourceText, c.SourceDeleted)
		if e != nil {
			return e
		}
		internal, e := res.LastInsertId()
		if e != nil {
			return e
		}
		for _, reply := range c.Replies {
			if _, err = tx.ExecContext(ctx, "INSERT INTO comment_reply(comment_id,local_id,body,author_type,created_at,updated_at,review_requested) VALUES(?,?,?,?,?,?,?)", internal, reply.ID, reply.Body, reply.Author.Type, reply.CreatedAt, reply.UpdatedAt, reply.ReviewRequested); err != nil {
				return err
			}
		}
	}
	if _, err = tx.ExecContext(ctx, "UPDATE comment_document SET updated_at=? WHERE id=?", db.Now(), id); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	// Once committed, publish the change even if the requesting client disconnects.
	notificationCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	return r.notifyCommentsChanged(notificationCtx, source)
}

func (r *Repository) Tags(ctx context.Context, documentID int64) ([]u.Tag, error) {
	query := `SELECT t.id,t.name,t.background_color,COUNT(l.document_id),t.created_at,t.updated_at FROM document_tag t LEFT JOIN document_tag_link l ON l.tag_id=t.id GROUP BY t.id ORDER BY t.name`
	args := []any{}
	if documentID != 0 {
		query = `SELECT t.id,t.name,t.background_color,0,t.created_at,t.updated_at FROM document_tag t JOIN document_tag_link l ON l.tag_id=t.id WHERE l.document_id=? ORDER BY t.name`
		args = append(args, documentID)
	}
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	list := []u.Tag{}
	for rows.Next() {
		var t u.Tag
		if err = rows.Scan(&t.ID, &t.Name, &t.BackgroundColor, &t.DocumentCount, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, rows.Err()
}
func (r *Repository) SaveTag(ctx context.Context, t u.Tag) (u.Tag, error) {
	now := db.Now()
	var err error
	if t.ID == 0 {
		var res sql.Result
		res, err = r.DB.ExecContext(ctx, "INSERT INTO document_tag(name,background_color,created_at,updated_at) VALUES(?,?,?,?)", t.Name, t.BackgroundColor, now, now)
		if err == nil {
			t.ID, err = res.LastInsertId()
		}
	} else {
		var existing u.Tag
		err = r.DB.QueryRowContext(ctx, "SELECT name,background_color,created_at,updated_at FROM document_tag WHERE id=?", t.ID).Scan(&existing.Name, &existing.BackgroundColor, &existing.CreatedAt, &existing.UpdatedAt)
		if errors.Is(err, sql.ErrNoRows) {
			return t, u.Fail("not_found", "Tag not found.")
		}
		if err != nil {
			return t, err
		}
		if existing.Name == t.Name && existing.BackgroundColor == t.BackgroundColor {
			t.CreatedAt, t.UpdatedAt = existing.CreatedAt, existing.UpdatedAt
			return t, nil
		}
		var res sql.Result
		res, err = r.DB.ExecContext(ctx, "UPDATE document_tag SET name=?,background_color=?,updated_at=? WHERE id=?", t.Name, t.BackgroundColor, now, t.ID)
		if err == nil {
			n, _ := res.RowsAffected()
			if n == 0 {
				return t, u.Fail("not_found", "Tag not found.")
			}
		}
	}
	if err != nil {
		return t, err
	}
	t.UpdatedAt = now
	if err = r.DB.QueryRowContext(ctx, "SELECT created_at FROM document_tag WHERE id=?", t.ID).Scan(&t.CreatedAt); err != nil {
		return t, err
	}
	return t, nil
}
func (r *Repository) DeleteTag(ctx context.Context, id int64) error {
	return remove(ctx, r.DB, "DELETE FROM document_tag WHERE id=?", []any{id}, "Tag")
}
func (r *Repository) ReplaceTags(ctx context.Context, id int64, ids []int64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err = tx.ExecContext(ctx, "DELETE FROM document_tag_link WHERE document_id=?", id); err != nil {
		return err
	}
	for _, tag := range ids {
		if _, err = tx.ExecContext(ctx, "INSERT INTO document_tag_link(document_id,tag_id) VALUES(?,?) ON CONFLICT DO NOTHING", id, tag); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) ReplaceTagReferences(ctx context.Context, id int64, references []u.TagReference) ([]u.Tag, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	ids := map[int64]bool{}
	for _, reference := range references {
		tagID := reference.ID
		if reference.Name != "" {
			err = tx.QueryRowContext(ctx, "SELECT id FROM document_tag WHERE name=?", reference.Name).Scan(&tagID)
			if errors.Is(err, sql.ErrNoRows) {
				now := db.Now()
				result, e := tx.ExecContext(ctx, "INSERT INTO document_tag(name,background_color,created_at,updated_at) VALUES(?,'#718096',?,?)", reference.Name, now, now)
				if e != nil {
					return nil, e
				}
				tagID, err = result.LastInsertId()
			}
			if err != nil {
				return nil, err
			}
		} else {
			var found int64
			err = tx.QueryRowContext(ctx, "SELECT id FROM document_tag WHERE id=?", tagID).Scan(&found)
			if errors.Is(err, sql.ErrNoRows) {
				return nil, u.Fail("not_found", fmt.Sprintf("Tag %d not found.", tagID))
			}
			if err != nil {
				return nil, err
			}
		}
		if ids[tagID] {
			return nil, u.Fail("already_exists", "Tag is already added.")
		}
		ids[tagID] = true
	}
	if _, err = tx.ExecContext(ctx, "DELETE FROM document_tag_link WHERE document_id=?", id); err != nil {
		return nil, err
	}
	for tagID := range ids {
		if _, err = tx.ExecContext(ctx, "INSERT INTO document_tag_link(document_id,tag_id) VALUES(?,?)", id, tagID); err != nil {
			return nil, err
		}
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return r.Tags(ctx, id)
}
func noteTable(kind string) string {
	if kind == "memory" {
		return "document_memory"
	}
	return "document_instruction"
}
func (r *Repository) Notes(ctx context.Context, kind string, id int64) ([]u.Note, error) {
	rows, err := r.DB.QueryContext(ctx, "SELECT id,document_id,content,created_at,updated_at FROM "+noteTable(kind)+" WHERE document_id=? ORDER BY id", id) // #nosec G202 -- The table identifier comes from a fixed internal allowlist; values use SQL parameters.
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	list := []u.Note{}
	for rows.Next() {
		var n u.Note
		if err = rows.Scan(&n.ID, &n.DocumentID, &n.Content, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	return list, rows.Err()
}
func (r *Repository) SaveNote(ctx context.Context, kind string, n u.Note) (u.Note, error) {
	now := db.Now()
	if kind == "instruction" && n.ID == 0 {
		err := r.DB.QueryRowContext(ctx, `INSERT INTO document_instruction(document_id,content,created_at,updated_at) VALUES(?,?,?,?)
			ON CONFLICT(document_id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at
			RETURNING id,document_id,content,created_at,updated_at`, n.DocumentID, n.Content, now, now).
			Scan(&n.ID, &n.DocumentID, &n.Content, &n.CreatedAt, &n.UpdatedAt)
		return n, err
	}
	var err error
	var res sql.Result
	if n.ID == 0 {
		n.CreatedAt = now
		res, err = r.DB.ExecContext(ctx, "INSERT INTO "+noteTable(kind)+"(document_id,content,created_at,updated_at) VALUES(?,?,?,?)", n.DocumentID, n.Content, now, now) // #nosec G202 -- The table identifier comes from a fixed internal allowlist; values use SQL parameters.
		if err == nil {
			n.ID, err = res.LastInsertId()
		}
	} else {
		res, err = r.DB.ExecContext(ctx, "UPDATE "+noteTable(kind)+" SET content=?,updated_at=? WHERE document_id=? AND id=?", n.Content, now, n.DocumentID, n.ID) // #nosec G202 -- The table identifier comes from a fixed internal allowlist; values use SQL parameters.
		if err == nil {
			count, _ := res.RowsAffected()
			if count == 0 {
				return n, u.Fail("not_found", "Note not found.")
			}
		}
	}
	if err != nil {
		return n, err
	}
	list, err := r.Notes(ctx, kind, n.DocumentID)
	if err != nil {
		return n, err
	}
	for _, saved := range list {
		if saved.ID == n.ID {
			return saved, nil
		}
	}
	return n, u.Fail("not_found", "Note not found.")
}
func remove(ctx context.Context, database *sql.DB, query string, args []any, name string) error {
	res, err := database.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err == nil && n == 0 {
		return u.Fail("not_found", name+" not found.")
	}
	return err
}
func (r *Repository) DeleteNote(ctx context.Context, kind string, docID, id int64) error {
	return remove(ctx, r.DB, "DELETE FROM "+noteTable(kind)+" WHERE document_id=? AND id=?", []any{docID, id}, "Note")
}
func (r *Repository) Statistics(ctx context.Context) (any, error) {
	var documents, human, bot int64
	if err := r.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM comment_document").Scan(&documents); err != nil {
		return nil, err
	}
	if err := r.DB.QueryRowContext(ctx, "SELECT COUNT(CASE WHEN author_type='human' THEN 1 END),COUNT(CASE WHEN author_type='bot' THEN 1 END) FROM comment").Scan(&human, &bot); err != nil {
		return nil, err
	}
	var size int64
	if info, err := os.Stat(r.Path); err == nil {
		size = info.Size()
	}
	return map[string]any{"documentCount": documents, "commentCount": map[string]int64{"human": human, "bot": bot}, "databaseSize": size}, nil
}
