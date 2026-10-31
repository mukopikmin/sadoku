package api

import (
	"context"
	"encoding/json"
	"errors"

	"connectrpc.com/connect"
	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/session"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

type Service struct{ Session *session.Session }

func invoke(ctx context.Context, s *Service, operation string, in, out proto.Message) error {
	b, err := protojson.Marshal(in)
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}
	input, err := session.DecodeInput(b)
	if err != nil {
		return rpcError(err)
	}
	if operation == "UpdateSettings" {
		current, _, readErr := config.Read()
		if readErr != nil {
			return rpcError(readErr)
		}
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(b, &fields); err != nil {
			return rpcError(err)
		}
		if _, ok := fields["showHtmlComments"]; !ok {
			input.ShowHTMLComments = current.ShowHTMLComments
		}
		if _, ok := fields["showHighlightBoundaries"]; !ok {
			input.ShowHighlightBoundaries = current.ShowHighlightBoundaries
		}
	}
	result, err := s.Session.Invoke(ctx, operation, input)
	if err != nil {
		return rpcError(err)
	}
	b, err = json.Marshal(result)
	if err != nil {
		return connect.NewError(connect.CodeInternal, errors.New("Failed to encode response."))
	}
	if err = (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(b, out); err != nil {
		return connect.NewError(connect.CodeInternal, errors.New("Failed to encode response."))
	}
	return nil
}
func rpcError(err error) error {
	var failure *u.Failure
	if errors.As(err, &failure) {
		code := connect.CodeInternal
		switch failure.Kind {
		case "invalid_argument":
			code = connect.CodeInvalidArgument
		case "not_found":
			code = connect.CodeNotFound
		case "already_exists":
			code = connect.CodeAlreadyExists
		case "aborted":
			code = connect.CodeAborted
		case "failed_precondition":
			code = connect.CodeFailedPrecondition
		case "unimplemented":
			code = connect.CodeUnimplemented
		}
		return connect.NewError(code, errors.New(failure.Message))
	}
	return connect.NewError(connect.CodeInternal, errors.New("Internal server error."))
}
