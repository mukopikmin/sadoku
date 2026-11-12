package session

import (
	"context"
	"os"
	"reflect"

	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

// Called with Mu held, like document and comment operations.
func (s *Session) tableLayouts(ctx context.Context, operation string, in Input) (any, error) {
	id := int64(in.DocumentID)
	markdown, err := s.readOutsideLock(ctx, s.Sources[id])
	if os.IsNotExist(err) {
		snapshot, _, snapshotErr := s.Repository.Snapshot(ctx, id)
		if snapshotErr != nil {
			return nil, snapshotErr
		}
		if snapshot != nil {
			markdown, err = *snapshot, nil
		}
	}
	if err != nil {
		return nil, err
	}
	if markdown != in.DisplayedMarkdown {
		return nil, u.Fail("aborted", "The document changed. Reload it before changing column widths.")
	}
	storageID, _, err := s.commentStorage(ctx, id, true)
	if err != nil {
		return nil, err
	}
	state, err := s.Repository.ReadTableLayouts(ctx, storageID)
	if err != nil {
		return nil, err
	}
	if operation == "GetTableLayouts" {
		next, err := u.ResolveTableLayouts(state, markdown, in.Tables)
		if err != nil {
			return nil, err
		}
		if !reflect.DeepEqual(state, next) {
			if err = s.Repository.SaveTableLayouts(ctx, storageID, next); err != nil {
				return nil, err
			}
		}
		return map[string]any{"tables": next.Tables}, nil
	}
	if state.Markdown != markdown {
		return nil, u.Fail("aborted", "The table layout changed. Reload it before changing column widths.")
	}
	for i := range state.Tables {
		if state.Tables[i].ID != in.TableID {
			continue
		}
		if err = u.ValidateColumnWidths(in.ColumnWidths, state.Tables[i].ColumnCount); err != nil {
			return nil, err
		}
		state.Tables[i].ColumnWidths = append([]float64{}, in.ColumnWidths...)
		if err = s.Repository.SaveTableLayouts(ctx, storageID, state); err != nil {
			return nil, err
		}
		return state.Tables[i], nil
	}
	return nil, u.Fail("not_found", "Table layout not found.")
}
