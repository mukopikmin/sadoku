package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

// Batch resolution and single edits publish one notification after commit.
func (r *Repository) SaveCommentEdits(ctx context.Context, id int64, snapshot *string, edits []u.CommentEdit) error {
	return r.writeComments(ctx, id, snapshot, func(tx *sql.Tx) error {
		for _, edit := range edits {
			if err := applyCommentEdit(ctx, tx, id, edit); err != nil {
				return err
			}
		}
		return nil
	})
}

func applyCommentEdit(ctx context.Context, tx *sql.Tx, id int64, edit u.CommentEdit) error {
	c := edit.Comment
	if edit.Operation == "CreateComment" {
		_, err := insertComment(ctx, tx, id, c)
		return err
	}
	var result sql.Result
	var err error
	switch edit.Operation {
	case "DeleteComment":
		result, err = tx.ExecContext(ctx, "DELETE FROM comment WHERE document_id=? AND local_id=?", id, c.ID)
	case "UpdateComment":
		result, err = tx.ExecContext(ctx, "UPDATE comment SET body=?,updated_at=? WHERE document_id=? AND local_id=?", c.Body, c.UpdatedAt, id, c.ID)
	case "SetCommentResolution":
		var resolver *string
		if c.ResolvedBy != nil {
			resolver = &c.ResolvedBy.Type
		}
		result, err = tx.ExecContext(ctx, "UPDATE comment SET resolved=?,resolved_at=?,resolved_by_type=?,updated_at=? WHERE document_id=? AND local_id=?", c.Resolved, c.ResolvedAt, resolver, c.UpdatedAt, id, c.ID)
	case "CreateReply", "DeleteReply", "UpdateReply":
		return applyReplyEdit(ctx, tx, id, edit)
	default:
		return fmt.Errorf("unknown comment edit %q", edit.Operation)
	}
	return checkEditResult(result, err, "Comment not found.")
}

func applyReplyEdit(ctx context.Context, tx *sql.Tx, id int64, edit u.CommentEdit) error {
	var parent int64
	var resolved bool
	err := tx.QueryRowContext(ctx, "UPDATE comment SET updated_at=? WHERE document_id=? AND local_id=? RETURNING id,resolved", edit.Comment.UpdatedAt, id, edit.Comment.ID).Scan(&parent, &resolved)
	if errors.Is(err, sql.ErrNoRows) {
		return u.Fail("not_found", "Comment not found.")
	}
	if err != nil {
		return err
	}
	reply := edit.Reply
	if edit.Operation == "CreateReply" {
		if resolved && reply.ReviewRequested {
			return u.Fail("invalid_argument", "Cannot request review on a resolved comment.")
		}
		return insertReply(ctx, tx, parent, reply)
	}
	var result sql.Result
	if edit.Operation == "DeleteReply" {
		result, err = tx.ExecContext(ctx, "DELETE FROM comment_reply WHERE comment_id=? AND local_id=?", parent, reply.ID)
	} else {
		result, err = tx.ExecContext(ctx, "UPDATE comment_reply SET body=?,updated_at=? WHERE comment_id=? AND local_id=?", reply.Body, reply.UpdatedAt, parent, reply.ID)
	}
	return checkEditResult(result, err, "Reply not found.")
}

func checkEditResult(result sql.Result, err error, missing string) error {
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err == nil && count == 0 {
		return u.Fail("not_found", missing)
	}
	return err
}
