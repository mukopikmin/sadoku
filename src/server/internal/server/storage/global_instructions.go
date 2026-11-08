package storage

import "context"

import (
	"github.com/mukopikmin/sadoku/internal/server/db"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func (r *Repository) GlobalInstructions(ctx context.Context) ([]u.Note, error) {
	rows, err := r.DB.QueryContext(ctx, "SELECT id,content,created_at,updated_at FROM global_instruction ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
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

func (r *Repository) SaveGlobalInstruction(ctx context.Context, n u.Note) (u.Note, error) {
	now := db.Now()
	if n.ID == 0 {
		err := r.DB.QueryRowContext(ctx, `INSERT INTO global_instruction(content,created_at,updated_at) VALUES(?,?,?)
			ON CONFLICT DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at
			RETURNING id,content,created_at,updated_at`, n.Content, now, now).
			Scan(&n.ID, &n.Content, &n.CreatedAt, &n.UpdatedAt)
		return n, err
	} else {
		res, err := r.DB.ExecContext(ctx, "UPDATE global_instruction SET content=?,updated_at=? WHERE id=?", n.Content, now, n.ID)
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

	err := r.DB.QueryRowContext(ctx, "SELECT id,content,created_at,updated_at FROM global_instruction WHERE id=?", n.ID).Scan(&n.ID, &n.Content, &n.CreatedAt, &n.UpdatedAt)
	return n, err
}

func (r *Repository) DeleteGlobalInstruction(ctx context.Context, id int64) error {
	return remove(ctx, r.DB, "DELETE FROM global_instruction WHERE id=?", []any{id}, "Note")
}
