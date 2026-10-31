package cli

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/mukopikmin/sadoku/src/server/session"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
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

// executeInstructionValue exposes a single text value without a resource ID.
func executeInstructionValue(repo u.Repository, documentID int64, o Options, out io.Writer) error {
	var notes []u.Note
	var err error
	if documentID == 0 {
		notes, err = repo.GlobalInstructions()
	} else {
		notes, err = repo.Notes("instruction", documentID)
	}
	if err != nil {
		return commandError("instruction", err)
	}
	content := ""
	if len(notes) > 0 {
		content = notes[0].Content
	}
	operation := o.Words[1]
	if operation != "get" {
		content = ""
		if operation == "set" {
			content = strings.TrimRight(strings.ReplaceAll(strings.ReplaceAll(o.Values["content"], "\r\n", "\n"), "\r", "\n"), "\n")
		}
		if u.TrimSpace(content) == "" {
			content = ""
			if len(notes) > 0 {
				if documentID == 0 {
					err = repo.DeleteGlobalInstruction(notes[0].ID)
				} else {
					err = repo.DeleteNote("instruction", documentID, notes[0].ID)
				}
			}
		} else if documentID == 0 {
			_, err = repo.SaveGlobalInstruction(u.Note{Content: content})
		} else {
			_, err = repo.SaveNote("instruction", u.Note{DocumentID: documentID, Content: content})
		}
		if err != nil {
			return commandError("instruction", err)
		}
	}
	return printJSON(out, map[string]string{"content": content})
}
