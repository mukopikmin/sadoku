package storage

import (
	"database/sql"
	"errors"
	"os"

	"github.com/mukopikmin/sadoku/src/server/db"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

type Repository struct {
	DB   *sql.DB
	Path string
}

func (r *Repository) Ensure(path string) (u.Document, error) {
	now := db.Now()
	_, err := r.DB.Exec("INSERT INTO comment_document(file_path,created_at,updated_at) VALUES(?,?,?) ON CONFLICT(file_path) DO NOTHING", path, now, now)
	if err != nil {
		return u.Document{}, err
	}
	var d u.Document
	err = r.DB.QueryRow("SELECT id,file_path,title FROM comment_document WHERE file_path=?", path).Scan(&d.ID, &d.FilePath, &d.DisplayTitle)
	return d, err
}
func (r *Repository) Documents() ([]u.Document, error) {
	rows, err := r.DB.Query("SELECT id,file_path,title FROM comment_document ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
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
func (r *Repository) SetTitle(id int64, title *string) error {
	_, err := r.DB.Exec("UPDATE comment_document SET title=?,updated_at=? WHERE id=?", title, db.Now(), id)
	return err
}
func (r *Repository) Snapshot(id int64) (*string, *string, error) {
	var current, previous *string
	err := r.DB.QueryRow(`SELECT (SELECT markdown FROM document_revision WHERE id=d.source_revision_id),(SELECT markdown FROM document_revision WHERE id=d.previous_source_revision_id) FROM comment_document d WHERE id=?`, id).Scan(&current, &previous)
	return current, previous, err
}
func (r *Repository) Revisions(id int64) ([]u.Revision, error) {
	rows, err := r.DB.Query("SELECT id,recorded_at FROM document_revision WHERE document_id=? ORDER BY id DESC LIMIT 20", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
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
func (r *Repository) Revision(id, revID int64) (u.Revision, error) {
	var rev u.Revision
	err := r.DB.QueryRow(`SELECT id,recorded_at,markdown,(SELECT markdown FROM document_revision p WHERE p.document_id=r.document_id AND p.id<r.id ORDER BY p.id DESC LIMIT 1) FROM document_revision r WHERE document_id=? AND id=?`, id, revID).Scan(&rev.ID, &rev.RecordedAt, &rev.Markdown, &rev.PreviousMarkdown)
	if errors.Is(err, sql.ErrNoRows) {
		err = u.Fail("not_found", "Document revision not found.")
	}
	return rev, err
}
func record(tx *sql.Tx, id int64, markdown string) (int64, error) {
	res, err := tx.Exec("INSERT INTO document_revision(document_id,markdown) VALUES(?,?)", id, markdown)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}
func (r *Repository) RecordRevision(id int64, markdown string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var previous string
	err = tx.QueryRow("SELECT markdown FROM document_revision WHERE document_id=? ORDER BY id DESC LIMIT 1", id).Scan(&previous)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if err != nil || previous != markdown {
		if _, err = record(tx, id, markdown); err != nil {
			return err
		}
	}
	return tx.Commit()
}
func (r *Repository) InitializeSnapshot(id int64, markdown string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var revID *int64
	if err = tx.QueryRow("SELECT source_revision_id FROM comment_document WHERE id=?", id).Scan(&revID); err != nil {
		return err
	}
	if revID == nil {
		id2, err := record(tx, id, markdown)
		if err != nil {
			return err
		}
		if _, err = tx.Exec("UPDATE comment_document SET source_revision_id=? WHERE id=?", id2, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}
func (r *Repository) ReadComments(id int64) (u.Comments, error) {
	doc := u.Comments{Comments: []u.Comment{}}
	if err := r.DB.QueryRow("SELECT file_path FROM comment_document WHERE id=?", id).Scan(&doc.FilePath); err != nil {
		return doc, err
	}
	var err error
	doc.SourceSnapshot, doc.PreviousSourceSnapshot, err = r.Snapshot(id)
	if err != nil {
		return doc, err
	}
	rows, err := r.DB.Query(`SELECT id,local_id,body,author_type,start_line,end_line,original_start_line,original_end_line,created_at,updated_at,resolved,stale,resolved_at,resolved_by_type,source_hash,source_text,source_deleted FROM comment WHERE document_id=? ORDER BY local_id`, id)
	if err != nil {
		return doc, err
	}
	ids := []int64{}
	for rows.Next() {
		var c u.Comment
		var internal int64
		var resolver *string
		err = rows.Scan(&internal, &c.ID, &c.Body, &c.Author.Type, &c.StartLine, &c.EndLine, &c.OriginalStartLine, &c.OriginalEndLine, &c.CreatedAt, &c.UpdatedAt, &c.Resolved, &c.Stale, &c.ResolvedAt, &resolver, &c.SourceHash, &c.SourceText, &c.SourceDeleted)
		if err != nil {
			rows.Close()
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
	rows.Close()
	if err != nil {
		return doc, err
	}
	for i, internal := range ids {
		replies, err := r.DB.Query("SELECT local_id,body,author_type,created_at,updated_at,review_requested FROM comment_reply WHERE comment_id=? ORDER BY local_id", internal)
		if err != nil {
			return doc, err
		}
		for replies.Next() {
			var reply u.Reply
			if err = replies.Scan(&reply.ID, &reply.Body, &reply.Author.Type, &reply.CreatedAt, &reply.UpdatedAt, &reply.ReviewRequested); err != nil {
				replies.Close()
				return doc, err
			}
			doc.Comments[i].Replies = append(doc.Comments[i].Replies, reply)
		}
		err = replies.Err()
		replies.Close()
		if err != nil {
			return doc, err
		}
	}
	return doc, nil
}
func (r *Repository) SaveComments(id int64, doc u.Comments) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var old *string
	var currentID *int64
	if err = tx.QueryRow("SELECT source_revision_id,(SELECT markdown FROM document_revision WHERE id=source_revision_id) FROM comment_document WHERE id=?", id).Scan(&currentID, &old); err != nil {
		return err
	}
	if doc.SourceSnapshot != nil && (old == nil || *old != *doc.SourceSnapshot) {
		revID, e := record(tx, id, *doc.SourceSnapshot)
		if e != nil {
			return e
		}
		if _, err = tx.Exec("UPDATE comment_document SET previous_source_revision_id=source_revision_id,source_revision_id=? WHERE id=?", revID, id); err != nil {
			return err
		}
	}
	if _, err = tx.Exec("DELETE FROM comment WHERE document_id=?", id); err != nil {
		return err
	}
	for _, c := range doc.Comments {
		var resolver *string
		if c.ResolvedBy != nil {
			resolver = &c.ResolvedBy.Type
		}
		res, e := tx.Exec(`INSERT INTO comment(document_id,local_id,body,author_type,start_line,end_line,original_start_line,original_end_line,created_at,updated_at,resolved,stale,resolved_at,resolved_by_type,source_hash,source_text,source_deleted) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, c.ID, c.Body, c.Author.Type, c.StartLine, c.EndLine, c.OriginalStartLine, c.OriginalEndLine, c.CreatedAt, c.UpdatedAt, c.Resolved, c.Stale, c.ResolvedAt, resolver, c.SourceHash, c.SourceText, c.SourceDeleted)
		if e != nil {
			return e
		}
		internal, e := res.LastInsertId()
		if e != nil {
			return e
		}
		for _, reply := range c.Replies {
			if _, err = tx.Exec("INSERT INTO comment_reply(comment_id,local_id,body,author_type,created_at,updated_at,review_requested) VALUES(?,?,?,?,?,?,?)", internal, reply.ID, reply.Body, reply.Author.Type, reply.CreatedAt, reply.UpdatedAt, reply.ReviewRequested); err != nil {
				return err
			}
		}
	}
	if _, err = tx.Exec("UPDATE comment_document SET updated_at=? WHERE id=?", db.Now(), id); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) Tags(documentID int64) ([]u.Tag, error) {
	query := `SELECT t.id,t.name,t.background_color,COUNT(l.document_id),t.created_at,t.updated_at FROM document_tag t LEFT JOIN document_tag_link l ON l.tag_id=t.id GROUP BY t.id ORDER BY t.id`
	args := []any{}
	if documentID != 0 {
		query = `SELECT t.id,t.name,t.background_color,0,t.created_at,t.updated_at FROM document_tag t JOIN document_tag_link l ON l.tag_id=t.id WHERE l.document_id=? ORDER BY t.id`
		args = append(args, documentID)
	}
	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
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
func (r *Repository) SaveTag(t u.Tag) (u.Tag, error) {
	now := db.Now()
	var err error
	if t.ID == 0 {
		var res sql.Result
		res, err = r.DB.Exec("INSERT INTO document_tag(name,background_color,created_at,updated_at) VALUES(?,?,?,?)", t.Name, t.BackgroundColor, now, now)
		if err == nil {
			t.ID, err = res.LastInsertId()
		}
	} else {
		var res sql.Result
		res, err = r.DB.Exec("UPDATE document_tag SET name=?,background_color=?,updated_at=? WHERE id=?", t.Name, t.BackgroundColor, now, t.ID)
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
	if err = r.DB.QueryRow("SELECT created_at FROM document_tag WHERE id=?", t.ID).Scan(&t.CreatedAt); err != nil {
		return t, err
	}
	return t, nil
}
func (r *Repository) DeleteTag(id int64) error {
	return remove(r.DB, "DELETE FROM document_tag WHERE id=?", []any{id}, "Tag")
}
func (r *Repository) ReplaceTags(id int64, ids []int64) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec("DELETE FROM document_tag_link WHERE document_id=?", id); err != nil {
		return err
	}
	for _, tag := range ids {
		if _, err = tx.Exec("INSERT INTO document_tag_link(document_id,tag_id) VALUES(?,?) ON CONFLICT DO NOTHING", id, tag); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) ReplaceTagReferences(id int64, references []u.TagReference) ([]u.Tag, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	ids := map[int64]bool{}
	for _, reference := range references {
		tagID := reference.ID
		if reference.Name != "" {
			err = tx.QueryRow("SELECT id FROM document_tag WHERE name=?", reference.Name).Scan(&tagID)
			if errors.Is(err, sql.ErrNoRows) {
				now := db.Now()
				result, e := tx.Exec("INSERT INTO document_tag(name,background_color,created_at,updated_at) VALUES(?,'#718096',?,?)", reference.Name, now, now)
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
			err = tx.QueryRow("SELECT id FROM document_tag WHERE id=?", tagID).Scan(&found)
			if errors.Is(err, sql.ErrNoRows) {
				return nil, u.Fail("not_found", "Tag not found.")
			}
			if err != nil {
				return nil, err
			}
		}
		ids[tagID] = true
	}
	if _, err = tx.Exec("DELETE FROM document_tag_link WHERE document_id=?", id); err != nil {
		return nil, err
	}
	for tagID := range ids {
		if _, err = tx.Exec("INSERT INTO document_tag_link(document_id,tag_id) VALUES(?,?)", id, tagID); err != nil {
			return nil, err
		}
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return r.Tags(id)
}
func noteTable(kind string) string {
	if kind == "memory" {
		return "document_memory"
	}
	return "document_instruction"
}
func (r *Repository) Notes(kind string, id int64) ([]u.Note, error) {
	rows, err := r.DB.Query("SELECT id,document_id,content,created_at,updated_at FROM "+noteTable(kind)+" WHERE document_id=? ORDER BY id", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
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
func (r *Repository) SaveNote(kind string, n u.Note) (u.Note, error) {
	now := db.Now()
	var err error
	var res sql.Result
	if n.ID == 0 {
		n.CreatedAt = now
		res, err = r.DB.Exec("INSERT INTO "+noteTable(kind)+"(document_id,content,created_at,updated_at) VALUES(?,?,?,?)", n.DocumentID, n.Content, now, now)
		if err == nil {
			n.ID, err = res.LastInsertId()
		}
	} else {
		res, err = r.DB.Exec("UPDATE "+noteTable(kind)+" SET content=?,updated_at=? WHERE document_id=? AND id=?", n.Content, now, n.DocumentID, n.ID)
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
	list, err := r.Notes(kind, n.DocumentID)
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
func remove(database *sql.DB, query string, args []any, name string) error {
	res, err := database.Exec(query, args...)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err == nil && n == 0 {
		return u.Fail("not_found", name+" not found.")
	}
	return err
}
func (r *Repository) DeleteNote(kind string, docID, id int64) error {
	return remove(r.DB, "DELETE FROM "+noteTable(kind)+" WHERE document_id=? AND id=?", []any{docID, id}, "Note")
}
func (r *Repository) Statistics() (any, error) {
	var documents, human, bot int64
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM comment_document").Scan(&documents); err != nil {
		return nil, err
	}
	if err := r.DB.QueryRow("SELECT COUNT(CASE WHEN author_type='human' THEN 1 END),COUNT(CASE WHEN author_type='bot' THEN 1 END) FROM comment").Scan(&human, &bot); err != nil {
		return nil, err
	}
	var size int64
	if info, err := os.Stat(r.Path); err == nil {
		size = info.Size()
	}
	return map[string]any{"documentCount": documents, "commentCount": map[string]int64{"human": human, "bot": bot}, "databaseSize": size}, nil
}
