package usecase

import (
	"context"
	"reflect"

	"github.com/mukopikmin/sadoku/internal/server/model"
)

func ListTableLayouts(ctx context.Context, repo Repository, documentID int64, markdown string, positions []model.TablePosition) ([]model.TableLayout, error) {
	state, err := repo.ReadTableLayouts(ctx, documentID)
	if err != nil {
		return nil, err
	}
	next, err := model.ResolveTableLayouts(state, markdown, positions)
	if err != nil {
		return nil, FromModelError(err)
	}
	if !reflect.DeepEqual(state, next) {
		if err = repo.SaveTableLayouts(ctx, documentID, next); err != nil {
			return nil, err
		}
	}
	return next.Tables, nil
}
