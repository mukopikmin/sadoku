package model

type RuleErrorKind uint8

const (
	InvalidInput RuleErrorKind = iota + 1
	MissingItem
	UnknownOperation
)

type RuleError struct {
	Kind    RuleErrorKind
	Message string
}

func (e *RuleError) Error() string { return e.Message }

var ErrCommentRange = &RuleError{InvalidInput, "Comment range is outside the Markdown source."}
