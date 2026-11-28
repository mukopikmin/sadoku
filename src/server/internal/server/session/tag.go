package session

import (
	"context"
	"regexp"
	"strings"

	"github.com/mukopikmin/sadoku/internal/server/model"
	"github.com/mukopikmin/sadoku/internal/server/usecase"
)

var tagColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func tagColor(color string) (string, error) {
	if !tagColorPattern.MatchString(color) {
		return "", usecase.Fail("invalid_argument", "Tag background color must be a hexadecimal RGB color.")
	}
	return strings.ToLower(color), nil
}

func tagWriteError(err error) error {
	if err != nil && strings.Contains(err.Error(), "UNIQUE") {
		return usecase.Fail("already_exists", "Tag name already exists.")
	}
	return err
}

func (s *Session) UpdateTag(ctx context.Context, id int64, patch model.TagPatch) (model.Tag, error) {
	if usecase.PositiveID(id) != nil {
		return model.Tag{}, usecase.Fail("invalid_argument", "Tag id must be a positive integer.")
	}
	if patch.Name != nil {
		name := model.TrimSpace(*patch.Name)
		if err := model.ValidateTagName(name); err != nil {
			return model.Tag{}, usecase.FromModelError(err)
		}
		patch.Name = &name
	}
	if patch.BackgroundColor != nil {
		color, err := tagColor(*patch.BackgroundColor)
		if err != nil {
			return model.Tag{}, err
		}
		patch.BackgroundColor = &color
	}
	tag, err := s.Repository.UpdateTag(ctx, id, patch)
	return tag, tagWriteError(err)
}
