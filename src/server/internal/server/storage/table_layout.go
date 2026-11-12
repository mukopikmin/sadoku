package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func (r *Repository) ReadTableLayouts(ctx context.Context, documentID int64) (u.TableLayoutState, error) {
	var state u.TableLayoutState
	var data string
	err := r.DB.QueryRowContext(ctx, "SELECT state FROM document_table_layout WHERE document_id=?", documentID).Scan(&data)
	if errors.Is(err, sql.ErrNoRows) {
		return state, nil
	}
	if err != nil {
		return state, err
	}
	err = json.Unmarshal([]byte(data), &state)
	return state, err
}

func (r *Repository) SaveTableLayouts(ctx context.Context, documentID int64, state u.TableLayoutState) error {
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	_, err = r.DB.ExecContext(ctx, "INSERT INTO document_table_layout(document_id,state) VALUES(?,?) ON CONFLICT(document_id) DO UPDATE SET state=excluded.state", documentID, string(data))
	return err
}
