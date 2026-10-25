package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
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
	ID                ID             `json:"id"`
	DocumentID        ID             `json:"documentId"`
	RevisionID        ID             `json:"revisionId"`
	InstructionID     ID             `json:"instructionId"`
	MemoryID          ID             `json:"memoryId"`
	CommentID         ID             `json:"commentId"`
	ReplyID           ID             `json:"replyId"`
	Directory         string         `json:"directory"`
	Filename          string         `json:"filename"`
	Title             string         `json:"title"`
	ExpectedMarkdown  *string        `json:"expectedMarkdown"`
	Content           string         `json:"content"`
	Name              string         `json:"name"`
	BackgroundColor   string         `json:"backgroundColor"`
	Tags              []TagReference `json:"tags"`
	Body              string         `json:"body"`
	StartLine         int            `json:"startLine"`
	EndLine           int            `json:"endLine"`
	Resolved          bool           `json:"resolved"`
	AsBot             bool           `json:"-"`
	RequestReview     bool           `json:"-"`
	HeadSHA           string         `json:"headSha"`
	DisplayedMarkdown string         `json:"displayedMarkdown"`
	CreatedAt         string         `json:"createdAt"`
	config.Settings
}

func (s *Session) Invoke(ctx context.Context, operation string, in Input) (any, error) {
	// These operations do not read or mutate session state. In particular, a
	// slow statistics query or GitHub command must not serialize progress RPCs.
	switch operation {
	case "GetStatistics":
		return s.Repository.Statistics()

	case "GetSettings":
		settings, _, err := config.Read()
		return settings, err
	case "UpdateSettings":
		if err := config.Save(in.Settings); err != nil {
			return nil, u.Fail("invalid_argument", err.Error())
		}
		return in.Settings, nil
	case "GetGitHubAccount":
		return GitHubAccount(ctx), nil
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
	case "ListDocuments":
		docs := append([]u.Document{}, s.Documents...)
		for i := range docs {
			tags, err := r.Tags(docs[i].ID)
			if err != nil {
				return nil, err
			}
			docs[i].Tags = tags
		}
		return map[string]any{"documents": docs}, nil
	case "ListTags":
		tags, err := r.Tags(0)
		return map[string]any{"tags": tags}, err
	case "UpdateTag", "CreateTag":
		if operation == "UpdateTag" {
			if err := u.PositiveID(int64(in.ID)); err != nil {
				return nil, u.Fail("invalid_argument", "Tag id must be a positive integer.")
			}
		}
		name := strings.TrimSpace(in.Name)
		if !u.ValidTagName(name) {
			return nil, u.Fail("invalid_argument", "Enter a valid tag name.")
		}
		color := in.BackgroundColor
		if color == "" && operation == "CreateTag" {
			color = "#718096"
		}
		if !regexp.MustCompile(`^#[0-9a-fA-F]{6}$`).MatchString(color) {
			return nil, u.Fail("invalid_argument", "Enter a valid tag background color.")
		}
		tag, err := r.SaveTag(u.Tag{ID: int64(in.ID), Name: name, BackgroundColor: strings.ToLower(color)})
		if err != nil && strings.Contains(err.Error(), "UNIQUE") {
			return nil, u.Fail("already_exists", "A tag with this name already exists.")
		}
		return tag, err
	case "DeleteTag":
		if err := u.PositiveID(int64(in.ID)); err != nil {
			return nil, u.Fail("invalid_argument", "Tag id must be a positive integer.")
		}
		return struct{}{}, r.DeleteTag(int64(in.ID))
	case "CreateDocument":
		return s.createDocument(in)
	}
	doc, err := s.Find(id)
	if err != nil {
		if operation == "ExportCommentToGitHub" {
			return nil, exportFailure("export_document_not_found")
		}
		return nil, err
	}
	switch operation {
	case "UpdateDocumentTitle":
		title := strings.TrimSpace(in.Title)
		if strings.ContainsAny(title, "\r\n\x00") {
			return nil, u.Fail("invalid_argument", "Title must be a single line.")
		}
		var value *string
		if title != "" {
			value = &title
		}
		if err = r.SetTitle(id, value); err != nil {
			return nil, err
		}
		doc.DisplayTitle = value
		for i := range s.Documents {
			if s.Documents[i].ID == id {
				s.Documents[i] = doc
			}
		}
		doc.Tags, err = r.Tags(id)
		return doc, err
	case "GetDocument":
		markdown, err := s.Read(ctx, id)
		if os.IsNotExist(err) {
			doc.Deleted = true
			snapshot, _, e := r.Snapshot(id)
			if e != nil {
				return nil, e
			}
			if snapshot == nil {
				return nil, u.Fail("not_found", "Saved Markdown snapshot not found.")
			}
			markdown = *snapshot
			err = nil
		}
		if err != nil {
			return nil, err
		}
		if !doc.Deleted {
			// A request may reach the document before the background queue does.
			// Preserve the first successfully displayed content, as the old loader did.
			if err = r.InitializeSnapshotContext(ctx, id, markdown); err != nil {
				return nil, err
			}
		}
		current, previous, err := r.Snapshot(s.CommentDocumentID(id))
		if err != nil {
			return nil, err
		}
		if current != nil && *current != markdown {
			previous = current
		}
		tags, err := r.Tags(id)
		if err != nil {
			return nil, err
		}
		_, _, remote := Source(s.Sources[id])
		fileURL := s.Sources[id]
		if !remote {
			fileURL = (&url.URL{Scheme: "file", Path: filepath.ToSlash(fileURL)}).String()
		}
		result := map[string]any{"fileUrl": fileURL, "markdown": markdown, "title": doc.Title, "deleted": doc.Deleted, "tags": tags, "canRestore": !remote && s.GitHub == nil}
		if doc.DisplayTitle != nil {
			result["displayTitle"] = *doc.DisplayTitle
		}
		if previous != nil && *previous != markdown {
			result["previousMarkdown"] = *previous
		}
		if s.GitHub != nil {
			result["githubHeadSha"] = s.GitHub.HeadSHA
		}
		return result, nil
	case "ListDocumentRevisions":
		list, err := r.Revisions(id)
		summaries := []map[string]any{}
		for _, rev := range list {
			summaries = append(summaries, map[string]any{"id": rev.ID, "recordedAt": rev.RecordedAt})
		}
		return map[string]any{"revisions": summaries}, err
	case "GetDocumentRevision":
		return r.Revision(id, int64(in.RevisionID))
	case "RestoreDocumentRevision":
		return struct{}{}, s.restore(ctx, doc, in)
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
				name := strings.TrimSpace(ref.Name)
				if !u.ValidTagName(name) {
					return nil, u.Fail("invalid_argument", "Enter a valid tag name.")
				}
				references = append(references, u.TagReference{Name: name})
			} else {
				if err := u.PositiveID(int64(ref.ID)); err != nil {
					return nil, u.Fail("invalid_argument", "Tag id must be a positive integer.")
				}
				references = append(references, u.TagReference{ID: int64(ref.ID)})
			}
		}
		tags, err := r.ReplaceTagReferences(id, references)
		return map[string]any{"tags": tags}, err

	case "ListInstructions", "ListMemories", "CreateInstruction", "UpdateInstruction", "DeleteInstruction", "CreateMemory", "UpdateMemory", "DeleteMemory":
		kind, key, noteID := "instruction", "instructions", int64(in.InstructionID)
		if strings.Contains(operation, "Memor") {
			kind, key, noteID = "memory", "memories", int64(in.MemoryID)
		}
		if strings.HasPrefix(operation, "List") {
			notes, err := r.Notes(kind, id)
			return map[string]any{key: notes}, err
		}
		if strings.HasPrefix(operation, "Delete") {
			return struct{}{}, r.DeleteNote(kind, id, noteID)
		}
		if strings.HasPrefix(operation, "Update") {
			if err := u.PositiveID(noteID); err != nil {
				return nil, u.Fail("not_found", "Note not found.")
			}
		}
		content := strings.TrimSpace(in.Content)
		if content == "" {
			return nil, u.Fail("invalid_argument", "Content must not be empty.")
		}
		return r.SaveNote(kind, u.Note{ID: noteID, DocumentID: id, Content: content})
	case "ListComments", "CreateComment", "UpdateComment", "DeleteComment", "SetCommentResolution", "CreateReply", "UpdateReply", "DeleteReply":
		comments, err := r.ReadComments(s.CommentDocumentID(id))
		if err != nil {
			return nil, err
		}
		markdown, err := s.Read(ctx, id)
		if os.IsNotExist(err) && comments.SourceSnapshot != nil {
			markdown = *comments.SourceSnapshot
			err = nil
		}
		if err != nil {
			return nil, err
		}
		if operation == "ListComments" {
			changed := comments.SourceSnapshot == nil || *comments.SourceSnapshot != markdown
			comments = u.ResolveComments(comments, markdown)
			if changed && len(comments.Comments) > 0 {
				if err = r.SaveComments(s.CommentDocumentID(id), comments); err != nil {
					return nil, err
				}
			}
			if s.GitHub != nil {
				comments.GitHubHeadSHA = s.GitHub.HeadSHA
			}
			return comments, nil
		}
		updated, result, err := u.ChangeComment(operation, comments, u.CommentInput{CommentID: int64(in.CommentID), ReplyID: int64(in.ReplyID), StartLine: in.StartLine, EndLine: in.EndLine, Body: in.Body, Resolved: in.Resolved, AsBot: in.AsBot, RequestReview: in.RequestReview}, markdown, db.Now())
		if err != nil {
			return nil, err
		}
		return result, r.SaveComments(s.CommentDocumentID(id), updated)
	case "ExportCommentToGitHub":
		if strings.TrimSpace(in.Body) == "" || in.StartLine < 1 || in.EndLine < in.StartLine || in.CreatedAt == "" || !regexp.MustCompile(`^[a-f0-9]{40,64}$`).MatchString(in.HeadSHA) {
			return nil, u.Fail("invalid_argument", `{"error":{"code":"export_invalid_request"}}`)
		}
		return s.exportComment(ctx, doc, in)
	}
	return nil, u.Fail("unimplemented", "Unknown operation.")
}

var invalidFilename = regexp.MustCompile(`[\\/\x00-\x1f<>:"|?*]`)
var reservedFilename = regexp.MustCompile(`(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)`)

func (s *Session) createDocument(in Input) (any, error) {
	if !s.CanCreate || (s.directoryStatus != nil && s.directoryStatus.State != "ready") {
		return nil, u.Fail("failed_precondition", "File creation is unavailable in this preview.")
	}
	name, title := strings.TrimSpace(in.Filename), strings.TrimSpace(in.Title)
	invalid := name == "" || name == "." || name == ".." || invalidFilename.MatchString(name) || reservedFilename.MatchString(name) || strings.HasSuffix(name, ".") || strings.HasSuffix(name, " ") || strings.ContainsAny(title, "\r\n\x00")
	if in.Directory != "" {
		for _, part := range strings.Split(in.Directory, "/") {
			if part == "" || part == "." || part == ".." || strings.ContainsAny(part, "\\:\x00\r\n") {
				invalid = true
			}
		}
	}
	if invalid {
		return nil, u.Fail("invalid_argument", "Enter a valid filename, directory, and single-line title.")
	}
	if !strings.Contains(name, ".") {
		name += ".md"
	}
	settings, _, err := config.Read()
	if err != nil {
		return nil, err
	}
	valid := false
	for _, ext := range settings.MarkdownExtensions {
		if strings.HasSuffix(strings.ToLower(name), strings.ToLower(ext)) {
			valid = true
		}
	}
	if !valid {
		return nil, u.Fail("invalid_argument", "Use a configured Markdown file extension.")
	}
	path := filepath.Join(s.Root, filepath.FromSlash(in.Directory), name)
	destination, err := ResolveLocal(s.Root, path, true)
	if err != nil {
		return nil, err
	}
	f, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if errors.Is(err, os.ErrExist) {
		return nil, u.Fail("already_exists", "Document already exists.")
	}
	if err != nil {
		return nil, err
	}
	if err = f.Close(); err != nil {
		return nil, err
	}
	doc, err := s.Repository.Ensure(path)
	if err != nil {
		return nil, err
	}
	if title != "" {
		doc.DisplayTitle = &title
		if err = s.Repository.SetTitle(doc.ID, &title); err != nil {
			return nil, err
		}
	}
	if err = s.Repository.InitializeSnapshot(doc.ID, ""); err != nil {
		return nil, err
	}
	rel, _ := filepath.Rel(s.Root, path)
	doc.RelativePath = filepath.ToSlash(rel)
	doc.Title = name
	doc.Tags = []u.Tag{}
	found := false
	for i, d := range s.Documents {
		if d.ID == doc.ID {
			s.Documents[i] = doc
			found = true
		}
	}
	if !found {
		s.Documents = append(s.Documents, doc)
	}
	s.Sources[doc.ID] = path
	sort.Slice(s.Documents, func(i, j int) bool { return s.Documents[i].RelativePath < s.Documents[j].RelativePath })
	return doc, nil
}
func (s *Session) restore(ctx context.Context, doc u.Document, in Input) error {
	_, _, remote := Source(s.Sources[doc.ID])
	if remote || s.GitHub != nil {
		return u.Fail("failed_precondition", "Only local files can be restored.")
	}
	destination, err := ResolveLocal(s.Root, doc.FilePath, true)
	if err != nil {
		return err
	}
	revision, err := s.Repository.Revision(doc.ID, int64(in.RevisionID))
	if err != nil {
		return err
	}
	contents, err := os.ReadFile(destination)
	exists := err == nil
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	if (in.ExpectedMarkdown == nil && exists) || (in.ExpectedMarkdown != nil && (!exists || *in.ExpectedMarkdown != string(contents))) {
		return u.Fail("aborted", "The file has changed. Reload the document before restoring.")
	}
	if exists {
		if err = s.Repository.RecordRevision(doc.ID, string(contents)); err != nil {
			return err
		}
	}
	// Check again after archiving and before atomically replacing the file.
	if err = SafeLocal(s.Root, doc.FilePath, true); err != nil {
		return err
	}
	latest, readErr := os.ReadFile(destination)
	if (readErr == nil) != exists || (exists && string(latest) != string(contents)) {
		return u.Fail("aborted", "The file has changed. Reload the document before restoring.")
	}
	mode := os.FileMode(0600)
	if info, e := os.Stat(destination); e == nil {
		mode = info.Mode().Perm()
	}
	if err = config.AtomicWrite(destination, []byte(revision.Markdown), mode); err != nil {
		return err
	}
	for i := range s.Documents {
		if s.Documents[i].ID == doc.ID {
			s.Documents[i].Deleted = false
		}
	}
	comments, err := s.Repository.ReadComments(doc.ID)
	if err != nil {
		return err
	}
	comments = u.ResolveComments(comments, revision.Markdown)
	if err = s.Repository.SaveComments(doc.ID, comments); err != nil {
		return err
	}
	return s.Repository.RecordRevision(doc.ID, revision.Markdown)
}

func DecodeInput(b []byte) (Input, error) {
	var in Input
	err := json.Unmarshal(b, &in)
	if err != nil {
		return in, u.Fail("invalid_argument", fmt.Sprintf("Invalid request: %s", err))
	}
	return in, nil
}
