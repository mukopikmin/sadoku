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
	if operation == "RestoreDocumentRevision" && u.PositiveID(int64(in.DocumentID)) == nil && u.PositiveID(int64(in.RevisionID)) == nil {
		if _, busy := s.restoring.LoadOrStore(in.DocumentID, struct{}{}); busy {
			return nil, u.Fail("aborted", "A restore is already in progress.")
		}
		defer s.restoring.Delete(in.DocumentID)
	}
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
		return s.Repository.Statistics()

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
		name := u.TrimSpace(in.Name)
		if err := u.ValidateTagName(name); err != nil {
			return nil, err
		}
		color := in.BackgroundColor
		if color == "" && operation == "CreateTag" {
			color = "#718096"
		}
		if !regexp.MustCompile(`^#[0-9a-fA-F]{6}$`).MatchString(color) {
			return nil, u.Fail("invalid_argument", "Tag background color must be a hexadecimal RGB color.")
		}
		tag, err := r.SaveTag(u.Tag{ID: int64(in.ID), Name: name, BackgroundColor: strings.ToLower(color)})
		if err != nil && strings.Contains(err.Error(), "UNIQUE") {
			return nil, u.Fail("already_exists", "Tag name already exists.")
		}
		return tag, err
	case "DeleteTag":
		if err := u.PositiveID(int64(in.ID)); err != nil {
			return nil, u.Fail("invalid_argument", "Tag id must be a positive integer.")
		}
		err := r.DeleteTag(int64(in.ID))
		if err != nil && err.Error() == "Tag not found." {
			err = u.Fail("not_found", fmt.Sprintf("Tag %d not found.", in.ID))
		}
		return struct{}{}, err
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
		if strings.ContainsAny(in.Title, "\r\n\x00") {
			return nil, u.Fail("invalid_argument", "Enter a single-line title.")
		}
		title := u.TrimSpace(in.Title)
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
		source := s.Sources[id]
		githubHead := ""
		if s.GitHub != nil {
			githubHead = s.GitHub.HeadSHA
		}
		markdown, err := s.readOutsideLock(ctx, source)
		if current, findErr := s.Find(id); findErr == nil && s.Sources[id] == source {
			doc.DisplayTitle = current.DisplayTitle
		}
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
		var current, previous *string
		storageID, _, err := s.commentStorage(id, false)
		if err != nil {
			return nil, err
		}
		if storageID != 0 {
			current, previous, err = r.Snapshot(storageID)
		}
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
		_, _, remote := Source(source)
		fileURL := source
		if !remote {
			path := filepath.ToSlash(fileURL)
			if strings.HasPrefix(path, "//") {
				host, rest, _ := strings.Cut(strings.TrimPrefix(path, "//"), "/")
				fileURL = (&url.URL{Scheme: "file", Host: host, Path: "/" + rest}).String()
			} else {
				if filepath.VolumeName(fileURL) != "" {
					path = "/" + path
				}
				fileURL = (&url.URL{Scheme: "file", Path: path}).String()
			}
		}
		result := map[string]any{"id": doc.ID, "relativePath": doc.RelativePath, "fileUrl": fileURL, "markdown": markdown, "title": doc.Title, "deleted": doc.Deleted, "tags": tags, "canRestore": !remote && s.GitHub == nil}
		if doc.DisplayTitle != nil {
			result["displayTitle"] = *doc.DisplayTitle
		}
		if previous != nil && *previous != markdown {
			result["previousMarkdown"] = *previous
		}
		if s.GitHub != nil {
			result["githubHeadSha"] = githubHead
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
			return struct{}{}, noteFailure(kind, r.DeleteNote(kind, id, noteID))
		}
		if strings.HasPrefix(operation, "Update") {
			if err := u.PositiveID(noteID); err != nil {
				return nil, noteFailure(kind, u.Fail("not_found", "Note not found."))
			}
		}
		if u.TrimSpace(in.Content) == "" {
			return nil, noteFailure(kind, u.Fail("invalid_argument", "Content must not be empty."))
		}
		note, err := r.SaveNote(kind, u.Note{ID: noteID, DocumentID: id, Content: in.Content})
		return note, noteFailure(kind, err)
	case "ListComments", "CreateComment", "UpdateComment", "DeleteComment", "SetCommentResolution", "CreateReply", "UpdateReply", "DeleteReply":
		githubHead := ""
		if s.GitHub != nil {
			githubHead = s.GitHub.HeadSHA
		}
		comments, err := s.readComments(id)
		if err != nil {
			return nil, err
		}
		markdown := ""
		if comments.SourceSnapshot != nil {
			markdown = *comments.SourceSnapshot
		}
		if operation == "ListComments" || operation == "CreateComment" {
			markdown, err = s.readOutsideLock(ctx, s.Sources[id])
			if err == nil || os.IsNotExist(err) {
				// A comment may have changed while the file/network read was pending.
				var commentErr error
				comments, commentErr = s.readComments(id)
				if commentErr != nil {
					return nil, commentErr
				}
			}
		}
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
				if err = s.saveComments(id, comments); err != nil {
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
		return result, s.saveComments(id, updated)
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

var invalidFilename = regexp.MustCompile(`[\\/\x00-\x1f<>:"|?*]`)
var reservedFilename = regexp.MustCompile(`(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)`)
var invalidDirectoryComponent = regexp.MustCompile(`[\\:\x00-\x1f]`)

func (s *Session) createDocument(in Input) (any, error) {
	if !s.CanCreate || (s.directoryStatus != nil && s.directoryStatus.State != "ready") {
		return nil, u.Fail("failed_precondition", "File creation is unavailable in this preview.")
	}
	name, title := u.TrimSpace(in.Filename), u.TrimSpace(in.Title)
	invalid := name == "" || name == "." || name == ".." || invalidFilename.MatchString(name) || reservedFilename.MatchString(name) || strings.HasSuffix(name, ".") || strings.HasSuffix(name, " ") || strings.ContainsAny(title, "\r\n\x00")
	if in.Directory != "" {
		for _, part := range strings.Split(in.Directory, "/") {
			if part == "" || part == "." || part == ".." || invalidDirectoryComponent.MatchString(part) {
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
	if err := createLocalDocument(s.Root, in.Directory, name); err != nil {
		return nil, err
	}

	doc, err := s.Repository.Ensure(path)
	if err != nil {
		return nil, createdDocumentRegistrationFailure()
	}
	doc.DisplayTitle = nil
	if title != "" {
		doc.DisplayTitle = &title
	}
	if err = s.Repository.SetTitle(doc.ID, doc.DisplayTitle); err != nil {
		return nil, createdDocumentRegistrationFailure()
	}
	if err = s.Repository.InitializeSnapshot(doc.ID, ""); err != nil {
		return nil, createdDocumentRegistrationFailure()
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
	sortDocuments(s.Documents)
	return doc, nil
}

func createdDocumentRegistrationFailure() error {
	return u.Fail("internal", "The file was created, but could not be added to the preview. Reopen this directory to load it.")
}
func (s *Session) restore(ctx context.Context, doc u.Document, in Input) error {
	_, _, remote := Source(s.Sources[doc.ID])
	if remote || s.GitHub != nil {
		return u.Fail("failed_precondition", "Only local files can be restored.")
	}
	revision, err := s.Repository.Revision(doc.ID, int64(in.RevisionID))
	if err != nil {
		return err
	}
	destination, err := ResolveLocal(s.Root, doc.FilePath, true)
	if err != nil {
		return err
	}
	contents, err := os.ReadFile(destination)
	exists := err == nil
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	if (in.ExpectedMarkdown == nil && exists) || (in.ExpectedMarkdown != nil && (!exists || *in.ExpectedMarkdown != decodeText(contents, false))) {
		return u.Fail("aborted", "The file has changed. Reload the document before restoring.")
	}
	if exists {
		if err = s.Repository.RecordRevision(doc.ID, decodeText(contents, false)); err != nil {
			return err
		}
	}
	// Check again after archiving and before atomically replacing the file.
	if err = SafeLocal(s.Root, doc.FilePath, true); err != nil {
		return err
	}
	latest, readErr := os.ReadFile(destination)
	if (readErr == nil) != exists || (exists && decodeText(latest, false) != decodeText(contents, false)) {
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
