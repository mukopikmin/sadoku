package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/mukopikmin/sadoku/internal/server/config"
	"github.com/mukopikmin/sadoku/internal/server/db"
	"github.com/mukopikmin/sadoku/internal/server/model"
	"github.com/mukopikmin/sadoku/internal/server/usecase"
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
	ID                ID                    `json:"id"`
	DocumentID        ID                    `json:"documentId"`
	InstructionID     ID                    `json:"instructionId"`
	MemoryID          ID                    `json:"memoryId"`
	CommentID         ID                    `json:"commentId"`
	ReplyID           ID                    `json:"replyId"`
	Content           string                `json:"content"`
	Name              string                `json:"name"`
	BackgroundColor   string                `json:"backgroundColor"`
	Tags              []TagReference        `json:"tags"`
	Body              string                `json:"body"`
	StartLine         int                   `json:"startLine"`
	EndLine           int                   `json:"endLine"`
	Resolved          bool                  `json:"resolved"`
	AsBot             bool                  `json:"-"`
	RequestReview     bool                  `json:"-"`
	HeadSHA           string                `json:"headSha"`
	DisplayedMarkdown string                `json:"displayedMarkdown"`
	Tables            []model.TablePosition `json:"tables"`
	TableID           string                `json:"tableId"`
	ColumnWidths      []float64             `json:"columnWidths"`
	CreatedAt         string                `json:"createdAt"`
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
			return nil, usecase.Fail("invalid_argument", "Request body must contain valid theme, codeWrap, fontScale, maxDepth, maxFiles, excludedDirectories, markdownExtensions, and showHtmlComments settings.")
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
			return nil, usecase.Fail("unimplemented", "Directory status is unavailable.")
		}
		return *s.directoryStatus, nil
	case "ListTags":
		tags, err := r.Tags(ctx, 0)
		return map[string]any{"tags": tags}, err
	case "UpdateTag":
		return s.UpdateTag(ctx, int64(in.ID), model.TagPatch{Name: &in.Name, BackgroundColor: &in.BackgroundColor})
	case "CreateTag":
		name := model.TrimSpace(in.Name)
		if err := model.ValidateTagName(name); err != nil {
			return nil, usecase.FromModelError(err)
		}
		color := in.BackgroundColor
		if color == "" {
			color = "#718096"
		}
		color, err := tagColor(color)
		if err != nil {
			return nil, err
		}
		tag, err := r.SaveTag(ctx, model.Tag{ID: int64(in.ID), Name: name, BackgroundColor: color})
		return tag, tagWriteError(err)
	case "DeleteTag":
		if err := usecase.PositiveID(int64(in.ID)); err != nil {
			return nil, usecase.Fail("invalid_argument", "Tag id must be a positive integer.")
		}
		err := r.DeleteTag(ctx, int64(in.ID))
		if err != nil && err.Error() == "Tag not found." {
			err = usecase.Fail("not_found", fmt.Sprintf("Tag %d not found.", in.ID))
		}
		return struct{}{}, err
	case "ListGlobalInstructions":
		notes, err := r.GlobalInstructions(ctx)
		return map[string]any{"instructions": notes}, err
	case "CreateGlobalInstruction", "UpdateGlobalInstruction", "DeleteGlobalInstruction":
		noteID := int64(in.InstructionID)
		if operation != "CreateGlobalInstruction" {
			if err := usecase.PositiveID(noteID); err != nil {
				return nil, noteFailure("instruction", usecase.Fail("not_found", "Note not found."))
			}
		}
		if operation == "DeleteGlobalInstruction" {
			return struct{}{}, noteFailure("instruction", r.DeleteGlobalInstruction(ctx, noteID))
		}
		if model.TrimSpace(in.Content) == "" {
			return nil, noteFailure("instruction", usecase.Fail("invalid_argument", "Content must not be empty."))
		}
		if operation == "CreateGlobalInstruction" {
			noteID = 0
		}
		note, err := r.SaveGlobalInstruction(ctx, model.Note{ID: noteID, Content: in.Content})
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
			return nil, usecase.Fail("invalid_argument", "A document can have at most 20 tags.")
		}
		references := []model.TagReference{}
		for _, ref := range in.Tags {
			if (ref.ID != 0 && ref.Name != "") || (ref.ID == 0 && ref.Name == "") {
				return nil, usecase.Fail("invalid_argument", "Each tag must contain either an id or name.")
			}
			if ref.Name != "" {
				name := model.TrimSpace(ref.Name)
				if err := model.ValidateTagName(name); err != nil {
					return nil, usecase.FromModelError(err)
				}
				references = append(references, model.TagReference{Name: name})
			} else {
				if err := usecase.PositiveID(int64(ref.ID)); err != nil {
					return nil, usecase.Fail("invalid_argument", "Tag id must be a positive integer.")
				}
				references = append(references, model.TagReference{ID: int64(ref.ID)})
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
			if err := usecase.PositiveID(noteID); err != nil {
				return nil, noteFailure(kind, usecase.Fail("not_found", "Note not found."))
			}
		}
		if model.TrimSpace(in.Content) == "" {
			return nil, noteFailure(kind, usecase.Fail("invalid_argument", "Content must not be empty."))
		}
		note, err := r.SaveNote(ctx, kind, model.Note{ID: noteID, DocumentID: id, Content: in.Content})
		return note, noteFailure(kind, err)
	case "ListComments":
		githubHead := ""
		if s.GitHub != nil {
			githubHead = s.GitHub.HeadSHA
		}
		comments, err := s.commentAccess(id).List(ctx)
		if err != nil {
			return nil, err
		}
		if s.GitHub != nil {
			comments.GitHubHeadSHA = githubHead
		}
		return comments, nil
	case "CreateComment", "UpdateComment", "DeleteComment", "SetCommentResolution", "CreateReply", "UpdateReply", "DeleteReply":
		input := model.CommentInput{
			CommentID: int64(in.CommentID), ReplyID: int64(in.ReplyID),
			StartLine: in.StartLine, EndLine: in.EndLine, Body: in.Body,
			Resolved: in.Resolved, AsBot: in.AsBot, RequestReview: in.RequestReview,
		}
		return s.commentAccess(id).Change(ctx, operation, input, db.Now)
	case "ExportCommentToGitHub":
		if s.GitHub == nil {
			return nil, usecase.Fail("not_found", `{"error":{"code":"export_unavailable"}}`)
		}
		in.Body = model.TrimSpace(in.Body)
		if in.Body == "" || in.StartLine < 1 || in.EndLine < in.StartLine || in.CreatedAt == "" || !regexp.MustCompile(`^[a-f0-9]{40,64}$`).MatchString(in.HeadSHA) {
			return nil, usecase.Fail("invalid_argument", `{"error":{"code":"export_invalid_request"}}`)
		}
		result, err := s.exportOutsideLock(ctx, doc, in)
		if err != nil {
			var failure *usecase.Failure
			if errors.As(err, &failure) && strings.HasPrefix(failure.Message, `{"error":{"code":"export_`) {
				return nil, err
			}
			return nil, exportFailure("export_failed")
		}
		return result, nil
	}
	return nil, usecase.Fail("unimplemented", "Unknown operation.")
}

func noteFailure(kind string, err error) error {
	if err == nil {
		return nil
	}
	name := strings.ToUpper(kind[:1]) + kind[1:]
	switch err.Error() {
	case "Note not found.":
		return usecase.Fail("not_found", name+" not found.")
	case "Content must not be empty.":
		return usecase.Fail("invalid_argument", name+" content must not be empty.")
	}
	return err
}

func DecodeInput(b []byte) (Input, error) {
	var in Input
	err := json.Unmarshal(b, &in)
	if err != nil {
		return in, usecase.Fail("invalid_argument", fmt.Sprintf("Invalid request: %s", err))
	}
	return in, nil
}
