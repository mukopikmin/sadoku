package session

import (
	"context"
	"regexp"
	"strings"

	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

var tagColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func tagColor(color string) (string, error) {
	if !tagColorPattern.MatchString(color) {
		return "", u.Fail("invalid_argument", "Tag background color must be a hexadecimal RGB color.")
	}
	return strings.ToLower(color), nil
}

func tagWriteError(err error) error {
	if err != nil && strings.Contains(err.Error(), "UNIQUE") {
		return u.Fail("already_exists", "Tag name already exists.")
	}
	return err
}

func (s *Session) UpdateTag(ctx context.Context, id int64, patch u.TagPatch) (u.Tag, error) {
	if u.PositiveID(id) != nil {
		return u.Tag{}, u.Fail("invalid_argument", "Tag id must be a positive integer.")
	}
	if patch.Name != nil {
		name := u.TrimSpace(*patch.Name)
		if err := u.ValidateTagName(name); err != nil {
			return u.Tag{}, err
		}
		patch.Name = &name
	}
	if patch.BackgroundColor != nil {
		color, err := tagColor(*patch.BackgroundColor)
		if err != nil {
			return u.Tag{}, err
		}
		patch.BackgroundColor = &color
	}
	tag, err := s.Repository.UpdateTag(ctx, id, patch)
	return tag, tagWriteError(err)
}
