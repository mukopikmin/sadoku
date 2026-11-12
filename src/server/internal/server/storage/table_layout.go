package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func (r *Repository) ReadTableLayouts(ctx context.Context, documentID int64) (u.TableLayoutState, error) {
	state := u.TableLayoutState{Tables: []u.TableLayout{}}
	tx, err := r.DB.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return state, err
	}
	defer func() { _ = tx.Rollback() }()
	var revisionID *int64
	var markdown *string
	err = tx.QueryRowContext(ctx, `SELECT table_layout_revision_id,(SELECT markdown FROM document_revision WHERE id=d.table_layout_revision_id AND document_id=d.id) FROM comment_document d WHERE id=?`, documentID).Scan(&revisionID, &markdown)
	if errors.Is(err, sql.ErrNoRows) {
		return u.TableLayoutState{}, nil
	}
	if err != nil {
		return state, err
	}
	if revisionID == nil {
		return u.TableLayoutState{}, nil
	}
	if markdown == nil {
		return state, fmt.Errorf("table layout revision does not belong to document %d", documentID)
	}
	state.Markdown = *markdown
	rows, err := tx.QueryContext(ctx, `SELECT t.id,t.start_line,t.end_line,t.column_count,w.column_index,w.width_px FROM markdown_table_layout t LEFT JOIN markdown_table_column_width w ON w.table_id=t.id WHERE t.document_id=? ORDER BY t.start_line,t.id,w.column_index`, documentID)
	if err != nil {
		return state, err
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var table u.TableLayout
		var index *int
		var width *float64
		if err = rows.Scan(&table.ID, &table.StartLine, &table.EndLine, &table.ColumnCount, &index, &width); err != nil {
			return state, err
		}
		if len(state.Tables) == 0 || state.Tables[len(state.Tables)-1].ID != table.ID {
			table.ColumnWidths = []float64{}
			state.Tables = append(state.Tables, table)
		}
		current := &state.Tables[len(state.Tables)-1]
		if index != nil {
			if *index < 0 || *index >= current.ColumnCount {
				return state, fmt.Errorf("invalid column index for table %s", current.ID)
			}
			for len(current.ColumnWidths) <= *index {
				current.ColumnWidths = append(current.ColumnWidths, 0)
			}
			current.ColumnWidths[*index] = *width
		}
	}
	if err = rows.Err(); err != nil {
		return state, err
	}
	if err = rows.Close(); err != nil {
		return state, err
	}
	return state, tx.Commit()
}

func (r *Repository) SaveTableLayouts(ctx context.Context, documentID int64, state u.TableLayoutState) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	var currentMarkdown *string
	if err = tx.QueryRowContext(ctx, `SELECT (SELECT markdown FROM document_revision WHERE id=d.table_layout_revision_id AND document_id=d.id) FROM comment_document d WHERE id=?`, documentID).Scan(&currentMarkdown); err != nil {
		return err
	}
	if currentMarkdown == nil || *currentMarkdown != state.Markdown {
		var revisionID int64
		err = tx.QueryRowContext(ctx, `SELECT id FROM document_revision WHERE document_id=? AND markdown=? ORDER BY id DESC LIMIT 1`, documentID, state.Markdown).Scan(&revisionID)
		if errors.Is(err, sql.ErrNoRows) {
			revisionID, err = record(ctx, tx, documentID, state.Markdown)
		}
		if err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, `UPDATE comment_document SET table_layout_revision_id=? WHERE id=?`, revisionID, documentID); err != nil {
			return err
		}
	}
	rows, err := tx.QueryContext(ctx, `SELECT id FROM markdown_table_layout WHERE document_id=?`, documentID)
	if err != nil {
		return err
	}
	defer func() { _ = rows.Close() }()
	existing := []string{}
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			return err
		}
		existing = append(existing, id)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	if err = rows.Close(); err != nil {
		return err
	}
	retained := make(map[string]bool)
	lastEnd := 0
	for _, table := range state.Tables {
		if retained[table.ID] || table.StartLine <= lastEnd {
			return fmt.Errorf("duplicate or overlapping table layout")
		}
		retained[table.ID] = true
		lastEnd = table.EndLine
		if err = u.ValidateColumnWidths(table.ColumnWidths, table.ColumnCount); err != nil {
			return err
		}
		result, e := tx.ExecContext(ctx, `INSERT INTO markdown_table_layout(id,document_id,start_line,end_line,column_count) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET start_line=excluded.start_line,end_line=excluded.end_line,column_count=excluded.column_count WHERE markdown_table_layout.document_id=excluded.document_id AND (start_line<>excluded.start_line OR end_line<>excluded.end_line OR column_count<>excluded.column_count)`, table.ID, documentID, table.StartLine, table.EndLine, table.ColumnCount)
		if e != nil {
			return e
		}
		count, e := result.RowsAffected()
		if e != nil {
			return e
		}
		if count == 0 {
			var owner int64
			if err = tx.QueryRowContext(ctx, "SELECT document_id FROM markdown_table_layout WHERE id=?", table.ID).Scan(&owner); err != nil {
				return err
			}
			if owner != documentID {
				return fmt.Errorf("table layout belongs to another document")
			}
		}
		if _, err = tx.ExecContext(ctx, `DELETE FROM markdown_table_column_width WHERE table_id=? AND column_index>=?`, table.ID, len(table.ColumnWidths)); err != nil {
			return err
		}
		for index, width := range table.ColumnWidths {
			if width == 0 {
				_, err = tx.ExecContext(ctx, `DELETE FROM markdown_table_column_width WHERE table_id=? AND column_index=?`, table.ID, index)
			} else {
				_, err = tx.ExecContext(ctx, `INSERT INTO markdown_table_column_width(table_id,column_index,width_px) VALUES(?,?,?) ON CONFLICT(table_id,column_index) DO UPDATE SET width_px=excluded.width_px WHERE width_px<>excluded.width_px`, table.ID, index, width)
			}
			if err != nil {
				return err
			}
		}
	}
	for _, id := range existing {
		if !retained[id] {
			if _, err = tx.ExecContext(ctx, `DELETE FROM markdown_table_layout WHERE id=? AND document_id=?`, id, documentID); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}
