package cli

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/mukopikmin/sadoku/internal/server/db"
	"github.com/mukopikmin/sadoku/internal/server/model"
	"github.com/mukopikmin/sadoku/internal/server/session"
)

func commandError(command string, err error) error {
	if command == "instruction" || command == "memory" {
		kind := strings.ToUpper(command[:1]) + command[1:]
		if err.Error() == "Note not found." {
			return fmt.Errorf("%s not found.", kind)
		}
		if err.Error() == "Content must not be empty." {
			return fmt.Errorf("%s content must not be empty.", kind)
		}
	}
	return err
}
func commentError(err error, in model.CommentInput) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, model.ErrCommentRange) {
		return fmt.Errorf("Comment range does not exist.")
	}
	switch err.Error() {
	case "Comment not found.":
		return fmt.Errorf("Comment not found: %d", in.CommentID)
	case "Reply not found.":
		return fmt.Errorf("Reply not found: %d", in.ReplyID)
	case "Review requests require a bot author.":
		return fmt.Errorf("Review requests require a bot reply.")
	}
	return err
}
func readCLI(ctx context.Context, s *session.Session, id int64) (string, error) {
	markdown, err := s.Read(ctx, id)
	if errors.Is(err, os.ErrNotExist) {
		return "", fmt.Errorf("No such file or directory (os error 2): readfile '%s'", s.Sources[id])
	}
	return markdown, err
}
func executeComments(ctx context.Context, s *session.Session, o Options, out io.Writer) error {
	repo := s.Repository
	id := s.Documents[0].ID
	comments, err := repo.ReadComments(ctx, id)
	if err != nil {
		return err
	}
	operation := o.Words[1]
	if operation == "list" {
		markdown, err := readCLI(ctx, s, id)
		if err != nil {
			return err
		}
		changed := comments.SourceSnapshot == nil || *comments.SourceSnapshot != markdown
		formats := map[int64]string{}
		for _, c := range comments.Comments {
			formats[c.ID] = "ListComments"
			if changed && comments.SourceSnapshot != nil {
				if c.Stale {
					formats[c.ID] = "ListCommentsStale"
				} else if !c.SourceDeleted {
					formats[c.ID] = "ListCommentsRebased"
				}
			}
		}
		comments = model.ResolveComments(comments, markdown)
		if changed && len(comments.Comments) > 0 {
			if err = repo.SaveComments(ctx, id, comments); err != nil {
				return err
			}
		}
		list := []object{}
		for _, c := range comments.Comments {
			list = append(list, commentOutput(c, formats[c.ID]))
		}
		return printJSON(out, object{{"comments", list}, {"filePath", comments.FilePath}})
	}
	in := model.CommentInput{Body: o.Values["body"], AsBot: o.Flags["as-bot"], RequestReview: o.Flags["request-review"]}
	op := ""
	markdown := ""
	if comments.SourceSnapshot != nil {
		markdown = *comments.SourceSnapshot
	}
	if operation == "resolve" || operation == "reopen" {
		wanted := map[int64]bool{}
		for _, w := range o.Words[2:] {
			n, _ := cliInteger(w)
			wanted[n] = true
		}
		known := map[int64]bool{}
		for _, c := range comments.Comments {
			known[c.ID] = true
		}
		missing := []string{}
		for _, w := range o.Words[2:] {
			n, _ := cliInteger(w)
			if !known[n] {
				missing = append(missing, strconv.FormatInt(n, 10))
			}
		}
		if len(missing) > 0 {
			return fmt.Errorf("Comment not found: %s", strings.Join(missing, ", "))
		}
		wasResolved := map[int64]bool{}
		for _, c := range comments.Comments {
			wasResolved[c.ID] = c.ResolvedAt != nil
		}
		now := db.Now()
		for _, c := range comments.Comments {
			if wanted[c.ID] {
				comments, _, err = model.ChangeComment("SetCommentResolution", comments, model.CommentInput{CommentID: c.ID, Resolved: operation == "resolve", AsBot: in.AsBot}, markdown, now)
				if err != nil {
					return err
				}
			}
		}
		if err = repo.SaveComments(ctx, id, comments); err != nil {
			return err
		}
		list := []object{}
		for _, c := range comments.Comments {
			if wanted[c.ID] {
				format := "Stored"
				if operation == "resolve" && !wasResolved[c.ID] {
					format = "Resolve"
				}
				list = append(list, commentOutput(c, format))
			}
		}
		result := object{{"comments", list}, {"filePath", comments.FilePath}}
		if comments.PreviousSourceSnapshot != nil {
			result = append(result, field{"previousSourceSnapshot", *comments.PreviousSourceSnapshot})
		}
		if comments.SourceSnapshot != nil {
			result = append(result, field{"sourceSnapshot", *comments.SourceSnapshot})
		}
		return printJSON(out, result)
	}
	switch operation {
	case "add":
		op = "CreateComment"
		markdown, err = readCLI(ctx, s, id)
		if err != nil {
			return err
		}
		n, _ := cliInteger(o.Values["start-line"])
		in.StartLine = int(n)
		in.EndLine = in.StartLine
		if v, ok := o.Values["end-line"]; ok {
			n, _ = cliInteger(v)
			in.EndLine = int(n)
		}
	case "update", "delete":
		n, _ := cliInteger(o.Words[2])
		in.CommentID = n
		op = strings.ToUpper(operation[:1]) + operation[1:] + "Comment"
	case "reply":
		n, _ := cliInteger(o.Values["comment"])
		in.CommentID = n
		action := o.Words[2]
		if action == "add" {
			op = "CreateReply"
		} else {
			n, _ = cliInteger(o.Words[3])
			in.ReplyID = n
			op = strings.ToUpper(action[:1]) + action[1:] + "Reply"
		}
	}
	updated, result, err := model.ChangeComment(op, comments, in, markdown, db.Now())
	if err != nil {
		return commentError(err, in)
	}
	if err = repo.SaveComments(ctx, id, updated); err != nil {
		return err
	}
	if op == "DeleteComment" {
		_, err = fmt.Fprintf(out, "Deleted comment %d.\n", in.CommentID)
		return err
	}
	if op == "DeleteReply" {
		_, err = fmt.Fprintf(out, "Deleted reply %d.\n", in.ReplyID)
		return err
	}
	c := result.(model.Comment)
	if op == "CreateReply" {
		current, err := readCLI(ctx, s, id)
		if err != nil {
			return err
		}
		text := c.CurrentSourceText
		c = model.ResolveComments(model.Comments{Comments: []model.Comment{c}}, current).Comments[0]
		c.CurrentSourceText = text
	}
	return printJSON(out, commentOutput(c, op))
}

func documentError(err error) error {
	if err.Error() == "Document already exists." {
		return fmt.Errorf("A file or folder with this name already exists.")
	}
	return err
}
