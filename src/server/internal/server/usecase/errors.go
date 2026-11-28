package usecase

import (
	"errors"
	"fmt"

	"github.com/mukopikmin/sadoku/internal/server/model"
)

type Failure struct{ Kind, Message string }

func (e *Failure) Error() string      { return e.Message }
func Fail(kind, message string) error { return &Failure{kind, message} }

func FromModelError(err error) error {
	var rule *model.RuleError
	if !errors.As(err, &rule) {
		return err
	}
	switch rule.Kind {
	case model.InvalidInput:
		return Fail("invalid_argument", err.Error())
	case model.MissingItem:
		return Fail("not_found", err.Error())
	case model.UnknownOperation:
		return Fail("unimplemented", err.Error())
	default:
		return err
	}
}

func PositiveID(id int64) error {
	if id < 1 || id > 9007199254740991 {
		return Fail("not_found", fmt.Sprintf("Invalid resource ID: %d.", id))
	}
	return nil
}
