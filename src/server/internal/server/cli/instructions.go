package cli

import "context"

import (
	"io"
	"strings"

	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

// executeInstructionValue exposes a single text value without a resource ID.
func executeInstructionValue(ctx context.Context, repo u.Repository, documentID int64, o Options, out io.Writer) error {
	var notes []u.Note
	var err error
	if documentID == 0 {
		notes, err = repo.GlobalInstructions(ctx)
	} else {
		notes, err = repo.Notes(ctx, "instruction", documentID)
	}
	if err != nil {
		return commandError("instruction", err)
	}
	content := ""
	if len(notes) > 0 {
		content = notes[0].Content
	}
	operation := o.Words[1]
	if operation == "set" {
		content = strings.TrimRight(strings.ReplaceAll(strings.ReplaceAll(o.Values["content"], "\r\n", "\n"), "\r", "\n"), "\n")
		if o.Values["content"] == "" {
			content = ""
			if len(notes) > 0 {
				if documentID == 0 {
					err = repo.DeleteGlobalInstruction(ctx, notes[0].ID)
				} else {
					err = repo.DeleteNote(ctx, "instruction", documentID, notes[0].ID)
				}
			}
		} else if documentID == 0 {
			_, err = repo.SaveGlobalInstruction(ctx, u.Note{Content: content})
		} else {
			_, err = repo.SaveNote(ctx, "instruction", u.Note{DocumentID: documentID, Content: content})
		}
		if err != nil {
			return commandError("instruction", err)
		}
	}
	return printJSON(out, map[string]string{"content": content})
}
