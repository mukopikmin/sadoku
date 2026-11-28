package usecase

import (
	"context"
	"errors"
	"os"

	"github.com/mukopikmin/sadoku/internal/server/model"
)

// CommentAccess supplies the storage and Markdown source for one document.
type CommentAccess struct {
	Read         func(context.Context) (model.Comments, error)
	ReadMarkdown func(context.Context) (string, error)
	Save         func(context.Context, model.Comments) error
}

func (access CommentAccess) load(ctx context.Context, readCurrent bool) (model.Comments, string, error) {
	comments, err := access.Read(ctx)
	if err != nil {
		return model.Comments{}, "", err
	}
	markdown := ""
	if readCurrent {
		markdown, err = access.ReadMarkdown(ctx)
		if err != nil && !os.IsNotExist(err) {
			return model.Comments{}, "", err
		}
		// A comment may have changed while the file/network read was pending.
		var commentErr error
		comments, commentErr = access.Read(ctx)
		if commentErr != nil {
			return model.Comments{}, "", commentErr
		}
	}
	if (!readCurrent || os.IsNotExist(err)) && comments.SourceSnapshot != nil {
		return comments, *comments.SourceSnapshot, nil
	}
	return comments, markdown, err
}

func (access CommentAccess) List(ctx context.Context) (model.Comments, error) {
	comments, markdown, err := access.load(ctx, true)
	if err != nil {
		return model.Comments{}, err
	}
	changed := comments.SourceSnapshot == nil || *comments.SourceSnapshot != markdown
	comments = model.ResolveComments(comments, markdown)
	if changed && len(comments.Comments) > 0 {
		if err := access.Save(ctx, comments); err != nil {
			return model.Comments{}, err
		}
	}
	return comments, nil
}

func (access CommentAccess) Change(ctx context.Context, operation string, input model.CommentInput, now func() string) (any, error) {
	create := operation == "CreateComment"
	comments, markdown, err := access.load(ctx, create)
	if err != nil {
		return nil, err
	}
	if create {
		if err := validateCommentRange(input.StartLine, input.EndLine); err != nil {
			return nil, err
		}
	}
	updated, result, err := model.ChangeComment(operation, comments, input, markdown, now())
	if err != nil {
		if errors.Is(err, model.ErrCommentRange) {
			return nil, Fail("invalid_argument", "Comment range does not exist.")
		}
		return nil, FromModelError(err)
	}
	return result, access.Save(ctx, updated)
}

func validateCommentRange(start, end int) error {
	if start < 1 {
		return Fail("invalid_argument", "Comment startLine must be a positive integer.")
	}
	if end < 1 {
		return Fail("invalid_argument", "Comment endLine must be a positive integer.")
	}
	if end < start {
		return Fail("invalid_argument", "Comment endLine must be greater than or equal to startLine.")
	}
	return nil
}
