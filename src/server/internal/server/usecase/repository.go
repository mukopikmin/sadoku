package usecase

import (
	"context"

	"github.com/mukopikmin/sadoku/internal/server/model"
)

// Repository is the persistence port shared by HTTP and command-line use cases.
type Repository interface {
	Ensure(context.Context, string) (model.Document, error)
	FindDocument(context.Context, string) (model.Document, bool, error)
	EnsureMany(context.Context, []string) ([]model.RegisteredDocument, error)
	Documents(context.Context) ([]model.Document, error)
	InitializeSnapshot(context.Context, int64, string) error
	SetTitle(context.Context, int64, *string) error
	Snapshot(context.Context, int64) (*string, *string, error)
	SaveComments(context.Context, int64, model.Comments) error
	ReadComments(context.Context, int64) (model.Comments, error)
	CommentsNotificationPath(context.Context, int64) (string, error)
	CommentsNotificationSourcePath(context.Context, string) (string, error)
	Revisions(context.Context, int64) ([]model.Revision, error)
	Revision(context.Context, int64, int64) (model.Revision, error)
	RecordRevision(context.Context, int64, string) error
	ReadTableLayouts(context.Context, int64) (model.TableLayoutState, error)
	SaveTableLayouts(context.Context, int64, model.TableLayoutState) error
	SaveTableColumnWidths(context.Context, int64, string, string, []float64) (model.TableLayout, error)
	Tags(context.Context, int64) ([]model.Tag, error)
	SaveTag(context.Context, model.Tag) (model.Tag, error)
	UpdateTag(context.Context, int64, model.TagPatch) (model.Tag, error)
	DeleteTag(context.Context, int64) error
	ReplaceTags(context.Context, int64, []int64) error
	ReplaceTagReferences(context.Context, int64, []model.TagReference) ([]model.Tag, error)
	Notes(context.Context, string, int64) ([]model.Note, error)
	SaveNote(context.Context, string, model.Note) (model.Note, error)
	DeleteNote(context.Context, string, int64, int64) error
	GlobalInstructions(context.Context) ([]model.Note, error)
	SaveGlobalInstruction(context.Context, model.Note) (model.Note, error)
	DeleteGlobalInstruction(context.Context, int64) error
	Statistics(context.Context) (any, error)
}
