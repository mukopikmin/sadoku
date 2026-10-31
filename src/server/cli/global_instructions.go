package cli

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/mukopikmin/sadoku/src/server/session"
)

func executeGlobalInstructions(ctx context.Context, s *session.Session, o Options, out io.Writer) error {
	operation := o.Words[1]
	in := session.Input{}
	if operation == "update" || operation == "delete" {
		id, err := number(o.Words[2], "instruction ID", 1)
		if err != nil {
			return err
		}
		in.InstructionID = session.ID(id)
	}
	in.Content = strings.TrimRight(strings.ReplaceAll(strings.ReplaceAll(o.Values["content"], "\r\n", "\n"), "\r", "\n"), "\n")
	rpc := map[string]string{"list": "ListGlobalInstructions", "add": "CreateGlobalInstruction", "update": "UpdateGlobalInstruction", "delete": "DeleteGlobalInstruction"}[operation]
	result, err := s.Invoke(ctx, rpc, in)
	if err != nil {
		return commandError("instruction", err)
	}
	if operation == "delete" {
		_, err = fmt.Fprintf(out, "Deleted global instruction %d.\n", in.InstructionID)
		return err
	}
	return printJSON(out, result)
}
