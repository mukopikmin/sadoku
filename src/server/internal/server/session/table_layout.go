package session

import (
	"context"
	"os"

	"github.com/mukopikmin/sadoku/internal/server/usecase"
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
		return nil, usecase.Fail("aborted", "The document changed. Reload it before changing column widths.")
	}
	storageID, _, err := s.commentStorage(ctx, id, true)
	if err != nil {
		return nil, err
	}
	if operation == "UpdateTableLayout" {
		return s.Repository.SaveTableColumnWidths(ctx, storageID, in.TableID, markdown, in.ColumnWidths)
	}
	tables, err := usecase.ListTableLayouts(ctx, s.Repository, storageID, markdown, in.Tables)
	if err != nil {
		return nil, err
	}
	return map[string]any{"tables": tables}, nil
}
