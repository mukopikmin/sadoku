package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/mukopikmin/sadoku/internal/server/config"
	"github.com/mukopikmin/sadoku/internal/server/db"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

// ID accepts both numeric REST IDs and the protobuf JSON representation of uint64.
type ID int64

func (id *ID) UnmarshalJSON(b []byte) error {
	n, err := strconv.ParseInt(strings.Trim(string(b), "\""), 10, 64)
	if err != nil {
		return err
	}
	*id = ID(n)
	return nil
}

type TagReference struct {
	ID   ID     `json:"id"`
	Name string `json:"name"`
}
type Input struct {
	ID                ID                `json:"id"`
	DocumentID        ID                `json:"documentId"`
	InstructionID     ID                `json:"instructionId"`
	MemoryID          ID                `json:"memoryId"`
	CommentID         ID                `json:"commentId"`
	ReplyID           ID                `json:"replyId"`
	Content           string            `json:"content"`
	Name              string            `json:"name"`
	BackgroundColor   string            `json:"backgroundColor"`
	Tags              []TagReference    `json:"tags"`
	Body              string            `json:"body"`
	StartLine         int               `json:"startLine"`
	EndLine           int               `json:"endLine"`
	Resolved          bool              `json:"resolved"`
	AsBot             bool              `json:"-"`
	RequestReview     bool              `json:"-"`
	HeadSHA           string            `json:"headSha"`
	DisplayedMarkdown string            `json:"displayedMarkdown"`
	Tables            []u.TablePosition `json:"tables"`
	TableID           string            `json:"tableId"`
	ColumnWidths      []float64         `json:"columnWidths"`
	CreatedAt         string            `json:"createdAt"`
	config.Settings
}

func (s *Session) Invoke(ctx context.Context, operation string, in Input) (any, error) {
	if operation == "ExportCommentToGitHub" {
		if !s.exporting.CompareAndSwap(false, true) {
			return nil, exportFailure("export_busy")
		}
		defer s.exporting.Store(false)
	}
	// These operations do not read or mutate session state. In particular, a
	// slow statistics query or GitHub command must not serialize progress RPCs.
	switch operation {
	case "GetStatistics":
		return s.Repository.Statistics(ctx)

	case "GetSettings":
		settings, _, err := config.Read()
		return settings, err
	case "UpdateSettings":
		if err := config.Validate(in.Settings, true); err != nil {
			return nil, u.Fail("invalid_argument", "Request body must contain valid theme, codeWrap, fontScale, maxDepth, maxFiles, excludedDirectories, markdownExtensions, and showHtmlComments settings.")
		}
		if err := config.Save(in.Settings); err != nil {
			return nil, err
		}
		return in.Settings, nil
	case "GetGitHubAccount":
		return GitHubAccount(ctx)
	}

	s.Mu.Lock()
	defer s.Mu.Unlock()
	r := s.Repository
	id := int64(in.DocumentID)
	switch operation {
	case "GetSession":
		return map[string]any{"canCreateDocuments": s.CanCreate, "pullRequest": s.PullRequest}, nil
	case "GetDirectoryStatus":
		if s.directoryStatus == nil {
			return nil, u.Fail("unimplemented", "Directory status is unavailable.")
		}
		return *s.directoryStatus, nil
	case "ListTags":
		tags, err := r.Tags(ctx, 0)
		return map[string]any{"tags": tags}, err
	case "UpdateTag":
		return s.UpdateTag(ctx, int64(in.ID), u.TagPatch{Name: &in.Name, BackgroundColor: &in.BackgroundColor})
	case "CreateTag":
		name := u.TrimSpace(in.Name)
		if err := u.ValidateTagName(name); err != nil {
			return nil, err
		}
		color := in.BackgroundColor
		if color == "" {
			color = "#718096"
		}
		color, err := tagColor(color)
		if err != nil {
			return nil, err
		}
		tag, err := r.SaveTag(ctx, u.Tag{ID: int64(in.ID), Name: name, BackgroundColor: color})
		return tag, tagWriteError(err)
	case "DeleteTag":
		if err := u.PositiveID(int64(in.ID)); err != nil {
			return nil, u.Fail("invalid_argument", "Tag id must be a positive integer.")
		}
		err := r.DeleteTag(ctx, int64(in.ID))
		if err != nil && err.Error() == "Tag not found." {
			err = u.Fail("not_found", fmt.Sprintf("Tag %d not found.", in.ID))
		}
		return struct{}{}, err
	case "ListGlobalInstructions":
		notes, err := r.GlobalInstructions(ctx)
		return map[string]any{"instructions": notes}, err
	case "CreateGlobalInstruction", "UpdateGlobalInstruction", "DeleteGlobalInstruction":
		noteID := int64(in.InstructionID)
		if operation != "CreateGlobalInstruction" {
			if err := u.PositiveID(noteID); err != nil {
				return nil, noteFailure("instruction", u.Fail("not_found", "Note not found."))
			}
		}
		if operation == "DeleteGlobalInstruction" {
			return struct{}{}, noteFailure("instruction", r.DeleteGlobalInstruction(ctx, noteID))
		}
		if u.TrimSpace(in.Content) == "" {
			return nil, noteFailure("instruction", u.Fail("invalid_argument", "Content must not be empty."))
		}
		if operation == "CreateGlobalInstruction" {
			noteID = 0
		}
		note, err := r.SaveGlobalInstruction(ctx, u.Note{ID: noteID, Content: in.Content})
		return note, noteFailure("instruction", err)
	}
	doc, err := s.Find(id)
	if err != nil {
		if operation == "ExportCommentToGitHub" {
			return nil, exportFailure("export_document_not_found")
		}
		return nil, err
	}
	switch operation {
	case "GetTableLayouts", "UpdateTableLayout":
		return s.tableLayouts(ctx, operation, in)
	case "ReplaceDocumentTags":
		if len(in.Tags) > 20 {
			return nil, u.Fail("invalid_argument", "A document can have at most 20 tags.")
		}
		references := []u.TagReference{}
		for _, ref := range in.Tags {
			if (ref.ID != 0 && ref.Name != "") || (ref.ID == 0 && ref.Name == "") {
				return nil, u.Fail("invalid_argument", "Each tag must contain either an id or name.")
			}
			if ref.Name != "" {
				name := u.TrimSpace(ref.Name)
				if err := u.ValidateTagName(name); err != nil {
					return nil, err
				}
				references = append(references, u.TagReference{Name: name})
			} else {
				if err := u.PositiveID(int64(ref.ID)); err != nil {
					return nil, u.Fail("invalid_argument", "Tag id must be a positive integer.")
				}
				references = append(references, u.TagReference{ID: int64(ref.ID)})
			}
		}
		tags, err := r.ReplaceTagReferences(ctx, id, references)
		return map[string]any{"tags": tags}, err

	case "ListInstructions", "ListMemories", "CreateInstruction", "UpdateInstruction", "DeleteInstruction", "CreateMemory", "UpdateMemory", "DeleteMemory":
		kind, key, noteID := "instruction", "instructions", int64(in.InstructionID)
		if strings.Contains(operation, "Memor") {
			kind, key, noteID = "memory", "memories", int64(in.MemoryID)
		}
		if strings.HasPrefix(operation, "List") {
			notes, err := r.Notes(ctx, kind, id)
			return map[string]any{key: notes}, err
		}
		if strings.HasPrefix(operation, "Delete") {
			return struct{}{}, noteFailure(kind, r.DeleteNote(ctx, kind, id, noteID))
		}
		if strings.HasPrefix(operation, "Update") {
			if err := u.PositiveID(noteID); err != nil {
				return nil, noteFailure(kind, u.Fail("not_found", "Note not found."))
			}
		}
		if u.TrimSpace(in.Content) == "" {
			return nil, noteFailure(kind, u.Fail("invalid_argument", "Content must not be empty."))
		}
		note, err := r.SaveNote(ctx, kind, u.Note{ID: noteID, DocumentID: id, Content: in.Content})
		return note, noteFailure(kind, err)
	case "ListComments", "CreateComment", "UpdateComment", "DeleteComment", "SetCommentResolution", "CreateReply", "UpdateReply", "DeleteReply":
		githubHead := ""
		if s.GitHub != nil {
			githubHead = s.GitHub.HeadSHA
		}
		readSource := operation == "ListComments" || operation == "CreateComment"
		var markdown string
		var sourceErr error
		if readSource {
			source := s.Sources[id]
			markdown, sourceErr = s.readOutsideLock(ctx, source)
			if sourceErr != nil && !os.IsNotExist(sourceErr) {
				return nil, sourceErr
			}
			if s.Sources[id] != source {
				return nil, u.Fail("aborted", "The document changed. Reload it and try again.")
			}
		}
		// Fetch once after reacquiring the lock so concurrent edits are included.
		comments, err := s.readComments(ctx, id)
		if err != nil {
			return nil, err
		}
		if !readSource || sourceErr != nil {
			if comments.SourceSnapshot != nil {
				markdown = *comments.SourceSnapshot
			} else if sourceErr != nil {
				return nil, sourceErr
			}
		}
		if operation == "ListComments" {
			changed := comments.SourceSnapshot == nil || *comments.SourceSnapshot != markdown
			comments = u.ResolveComments(comments, markdown)
			if changed && len(comments.Comments) > 0 {
				if err = s.saveComments(ctx, id, comments); err != nil {
					return nil, err
				}
			}
			if s.GitHub != nil {
				comments.GitHubHeadSHA = githubHead
			}
			return comments, nil
		}
		if operation == "CreateComment" {
			if err := validateCommentRange(in.StartLine, in.EndLine); err != nil {
				return nil, err
			}
		}
		updated, result, err := u.ChangeComment(operation, comments, u.CommentInput{CommentID: int64(in.CommentID), ReplyID: int64(in.ReplyID), StartLine: in.StartLine, EndLine: in.EndLine, Body: in.Body, Resolved: in.Resolved, AsBot: in.AsBot, RequestReview: in.RequestReview}, markdown, db.Now())
		if err != nil {
			if err.Error() == "Comment range is outside the Markdown source." {
				return nil, u.Fail("invalid_argument", "Comment range does not exist.")
			}
			return nil, err
		}
		if comment, ok := result.(u.Comment); ok && operation != "CreateComment" && !comment.Stale && comments.SourceSnapshot != nil {
			comment.CurrentSourceText = u.RangeText(*comments.SourceSnapshot, comment.StartLine, comment.EndLine)
			result = comment
		}
		return result, s.saveComments(ctx, id, updated)
	case "ExportCommentToGitHub":
		if s.GitHub == nil {
			return nil, u.Fail("not_found", `{"error":{"code":"export_unavailable"}}`)
		}
		in.Body = u.TrimSpace(in.Body)
		if in.Body == "" || in.StartLine < 1 || in.EndLine < in.StartLine || in.CreatedAt == "" || !regexp.MustCompile(`^[a-f0-9]{40,64}$`).MatchString(in.HeadSHA) {
			return nil, u.Fail("invalid_argument", `{"error":{"code":"export_invalid_request"}}`)
		}
		result, err := s.exportOutsideLock(ctx, doc, in)
		if err != nil {
			var failure *u.Failure
			if errors.As(err, &failure) && strings.HasPrefix(failure.Message, `{"error":{"code":"export_`) {
				return nil, err
			}
			return nil, exportFailure("export_failed")
		}
		return result, nil
	}
	return nil, u.Fail("unimplemented", "Unknown operation.")
}

func validateCommentRange(start, end int) error {
	if start < 1 {
		return u.Fail("invalid_argument", "Comment startLine must be a positive integer.")
	}
	if end < 1 {
		return u.Fail("invalid_argument", "Comment endLine must be a positive integer.")
	}
	if end < start {
		return u.Fail("invalid_argument", "Comment endLine must be greater than or equal to startLine.")
	}
	return nil
}

func noteFailure(kind string, err error) error {
	if err == nil {
		return nil
	}
	name := strings.ToUpper(kind[:1]) + kind[1:]
	switch err.Error() {
	case "Note not found.":
		return u.Fail("not_found", name+" not found.")
	case "Content must not be empty.":
		return u.Fail("invalid_argument", name+" content must not be empty.")
	}
	return err
}

func DecodeInput(b []byte) (Input, error) {
	var in Input
	err := json.Unmarshal(b, &in)
	if err != nil {
		return in, u.Fail("invalid_argument", fmt.Sprintf("Invalid request: %s", err))
	}
	return in, nil
}
