package storage

import (
	"github.com/mukopikmin/sadoku/src/server/db"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

func (r *Repository) GlobalInstructions() ([]u.Note, error) {
	rows, err := r.DB.Query("SELECT id,content,created_at,updated_at FROM global_instruction ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	notes := []u.Note{}
	for rows.Next() {
		var n u.Note
		if err := rows.Scan(&n.ID, &n.Content, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

func (r *Repository) SaveGlobalInstruction(n u.Note) (u.Note, error) {
	now := db.Now()
	if n.ID == 0 {
		res, err := r.DB.Exec("INSERT INTO global_instruction(content,created_at,updated_at) VALUES(?,?,?)", n.Content, now, now)
		if err != nil {
			return n, err
		}
		n.ID, err = res.LastInsertId()
		if err != nil {
			return n, err
		}
	} else {
		res, err := r.DB.Exec("UPDATE global_instruction SET content=?,updated_at=? WHERE id=?", n.Content, now, n.ID)
		if err != nil {
			return n, err
		}
		count, err := res.RowsAffected()
		if err != nil {
			return n, err
		}
		if count == 0 {
			return n, u.Fail("not_found", "Note not found.")
		}
	}

	err := r.DB.QueryRow("SELECT id,content,created_at,updated_at FROM global_instruction WHERE id=?", n.ID).Scan(&n.ID, &n.Content, &n.CreatedAt, &n.UpdatedAt)
	return n, err
}

func (r *Repository) DeleteGlobalInstruction(id int64) error {
	return remove(r.DB, "DELETE FROM global_instruction WHERE id=?", []any{id}, "Note")
}
