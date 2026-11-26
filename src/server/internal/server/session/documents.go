package session

import (
	"context"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/mukopikmin/sadoku/internal/server/config"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

type DocumentPreview struct {
	u.Document
	FileURL, Markdown               string
	CanRestore                      bool
	PreviousMarkdown, GitHubHeadSHA *string
}

func (s *Session) ListDocuments(ctx context.Context) ([]u.Document, error) {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	docs := append([]u.Document{}, s.Documents...)
	for i := range docs {
		tags, err := s.Repository.Tags(ctx, docs[i].ID)
		if err != nil {
			return nil, err
		}
		docs[i].Tags = tags
	}
	return docs, nil
}

func (s *Session) UpdateDocumentTitle(ctx context.Context, id int64, titleInput string) (u.Document, error) {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	doc, err := s.Find(id)
	if err != nil {
		return u.Document{}, err
	}
	if strings.ContainsAny(titleInput, "\r\n\x00") {
		return u.Document{}, u.Fail("invalid_argument", "Enter a single-line title.")
	}
	title := u.TrimSpace(titleInput)
	var value *string
	if title != "" {
		value = &title
	}
	if err = s.Repository.SetTitle(ctx, id, value); err != nil {
		return u.Document{}, err
	}
	doc.DisplayTitle = value
	for i := range s.Documents {
		if s.Documents[i].ID == id {
			s.Documents[i] = doc
		}
	}
	doc.Tags, err = s.Repository.Tags(ctx, id)
	return doc, err
}

func (s *Session) GetDocument(ctx context.Context, id int64) (DocumentPreview, error) {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	doc, err := s.Find(id)
	if err != nil {
		return DocumentPreview{}, err
	}
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
		snapshot, _, e := s.Repository.Snapshot(ctx, id)
		if e != nil {
			return DocumentPreview{}, e
		}
		if snapshot == nil {
			return DocumentPreview{}, u.Fail("not_found", "Saved Markdown snapshot not found.")
		}
		markdown = *snapshot
		err = nil
	}
	if err != nil {
		return DocumentPreview{}, err
	}
	if !doc.Deleted {
		// A request may reach the document before the background queue does.
		// Preserve the first successfully displayed content, as the old loader did.
		if err = s.Repository.InitializeSnapshot(ctx, id, markdown); err != nil {
			return DocumentPreview{}, err
		}
	}
	var current, previous *string
	storageID, _, err := s.commentStorage(ctx, id, false)
	if err != nil {
		return DocumentPreview{}, err
	}
	if storageID != 0 {
		current, previous, err = s.Repository.Snapshot(ctx, storageID)
	}
	if err != nil {
		return DocumentPreview{}, err
	}
	if current != nil && *current != markdown {
		previous = current
	}
	tags, err := s.Repository.Tags(ctx, id)
	if err != nil {
		return DocumentPreview{}, err
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
	doc.Tags = tags
	result := DocumentPreview{Document: doc, FileURL: fileURL, Markdown: markdown, CanRestore: !remote && s.GitHub == nil}
	if previous != nil && *previous != markdown {
		result.PreviousMarkdown = previous
	}
	if s.GitHub != nil {
		result.GitHubHeadSHA = &githubHead
	}
	return result, nil
}

func (s *Session) ListDocumentRevisions(ctx context.Context, documentID int64) ([]u.Revision, error) {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	if _, err := s.Find(documentID); err != nil {
		return nil, err
	}
	return s.Repository.Revisions(ctx, documentID)
}

func (s *Session) GetDocumentRevision(ctx context.Context, documentID, revisionID int64) (u.Revision, error) {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	if _, err := s.Find(documentID); err != nil {
		return u.Revision{}, err
	}
	return s.Repository.Revision(ctx, documentID, revisionID)
}

var invalidFilename = regexp.MustCompile(`[\\/\x00-\x1f<>:"|?*]`)
var reservedFilename = regexp.MustCompile(`(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)`)
var invalidDirectoryComponent = regexp.MustCompile(`[\\:\x00-\x1f]`)

func (s *Session) CreateDocument(ctx context.Context, directory, filename, titleInput string) (u.Document, error) {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	if !s.CanCreate || (s.directoryStatus != nil && s.directoryStatus.State != "ready") {
		return u.Document{}, u.Fail("failed_precondition", "File creation is unavailable in this preview.")
	}
	name, title := u.TrimSpace(filename), u.TrimSpace(titleInput)
	invalid := name == "" || name == "." || name == ".." || invalidFilename.MatchString(name) || reservedFilename.MatchString(name) || strings.HasSuffix(name, ".") || strings.HasSuffix(name, " ") || strings.ContainsAny(title, "\r\n\x00")
	if directory != "" {
		for _, part := range strings.Split(directory, "/") {
			if part == "" || part == "." || part == ".." || invalidDirectoryComponent.MatchString(part) {
				invalid = true
			}
		}
	}
	if invalid {
		return u.Document{}, u.Fail("invalid_argument", "Enter a valid filename, directory, and single-line title.")
	}
	if !strings.Contains(name, ".") {
		name += ".md"
	}
	settings, _, err := config.Read()
	if err != nil {
		return u.Document{}, err
	}
	valid := false
	for _, ext := range settings.MarkdownExtensions {
		if strings.HasSuffix(strings.ToLower(name), strings.ToLower(ext)) {
			valid = true
		}
	}
	if !valid {
		return u.Document{}, u.Fail("invalid_argument", "Use a configured Markdown file extension.")
	}
	path := filepath.Join(s.Root, filepath.FromSlash(directory), name)
	if err := createLocalDocument(s.Root, directory, name); err != nil {
		return u.Document{}, err
	}

	doc, err := s.Repository.Ensure(ctx, path)
	if err != nil {
		return u.Document{}, createdDocumentRegistrationFailure()
	}
	doc.DisplayTitle = nil
	if title != "" {
		doc.DisplayTitle = &title
	}
	if err = s.Repository.SetTitle(ctx, doc.ID, doc.DisplayTitle); err != nil {
		return u.Document{}, createdDocumentRegistrationFailure()
	}
	if err = s.Repository.InitializeSnapshot(ctx, doc.ID, ""); err != nil {
		return u.Document{}, createdDocumentRegistrationFailure()
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
	return u.Fail("internal", "The file was created, but could not be added to the preview. Reload the document list to load it.")
}
func (s *Session) RestoreDocumentRevision(ctx context.Context, id, revisionID int64, expectedMarkdown *string) error {
	if u.PositiveID(id) == nil && u.PositiveID(revisionID) == nil {
		if _, busy := s.restoring.LoadOrStore(id, struct{}{}); busy {
			return u.Fail("aborted", "A restore is already in progress.")
		}
		defer s.restoring.Delete(id)
	}
	s.Mu.Lock()
	defer s.Mu.Unlock()
	doc, err := s.Find(id)
	if err != nil {
		return err
	}
	_, _, remote := Source(s.Sources[doc.ID])
	if remote || s.GitHub != nil {
		return u.Fail("failed_precondition", "Only local files can be restored.")
	}
	revision, err := s.Repository.Revision(ctx, doc.ID, revisionID)
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
	if (expectedMarkdown == nil && exists) || (expectedMarkdown != nil && (!exists || *expectedMarkdown != decodeText(contents, false))) {
		return u.Fail("aborted", "The file has changed. Reload the document before restoring.")
	}
	if exists {
		if err = s.Repository.RecordRevision(ctx, doc.ID, decodeText(contents, false)); err != nil {
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
	comments, err := s.Repository.ReadComments(ctx, doc.ID)
	if err != nil {
		return err
	}
	comments = u.ResolveComments(comments, revision.Markdown)
	if err = s.Repository.SaveComments(ctx, doc.ID, comments); err != nil {
		return err
	}
	return s.Repository.RecordRevision(ctx, doc.ID, revision.Markdown)
}
