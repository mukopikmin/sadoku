package cli

import (
	"io"
	"strings"

	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

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
	if operation == "set" {
		content = strings.TrimRight(strings.ReplaceAll(strings.ReplaceAll(o.Values["content"], "\r\n", "\n"), "\r", "\n"), "\n")
		if o.Values["content"] == "" {
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
