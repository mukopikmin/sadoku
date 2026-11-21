package session

import (
	"context"
	"os"
	"reflect"
	"slices"

	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func (s *Session) listComments(ctx context.Context, id int64) (u.Comments, error) {
	comments, markdown, source, pull, head, err := s.commentListSnapshot(ctx, id)
	if err != nil {
		return u.Comments{}, err
	}
	resolved := comments
	resolved.Comments = slices.Clone(comments.Comments)
	resolved = u.ResolveComments(resolved, markdown)
	if pull != nil {
		resolved.GitHubHeadSHA = head
	}
	if len(resolved.Comments) == 0 || (comments.SourceSnapshot != nil && *comments.SourceSnapshot == markdown) {
		return resolved, nil
	}

	s.Mu.Lock()
	defer s.Mu.Unlock()
	if s.Sources[id] != source || s.GitHub != pull || (pull != nil && pull.HeadSHA != head) {
		return u.Comments{}, u.Fail("aborted", "The document changed. Reload the comments and retry.")
	}
	latest, err := s.readComments(ctx, id)
	if err != nil {
		return u.Comments{}, err
	}
	if !reflect.DeepEqual(latest, comments) {
		return u.Comments{}, u.Fail("aborted", "Comments changed. Reload them and retry.")
	}
	return resolved, s.saveComments(ctx, id, resolved)
}

// Capture a consistent source and comment snapshot under the session lock.
// Reading the Markdown may temporarily release that lock, so check the source again.
func (s *Session) commentListSnapshot(ctx context.Context, id int64) (comments u.Comments, markdown, source string, pull *Pull, head string, err error) {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	if _, err = s.Find(id); err != nil {
		return
	}
	source, pull = s.Sources[id], s.GitHub
	if pull != nil {
		head = pull.HeadSHA
	}
	markdown, err = s.readOutsideLock(ctx, source)
	if err != nil && !os.IsNotExist(err) {
		return
	}
	if s.Sources[id] != source || s.GitHub != pull || (pull != nil && pull.HeadSHA != head) {
		err = u.Fail("aborted", "The document changed. Reload the comments and retry.")
		return
	}
	comments, readErr := s.readComments(ctx, id)
	if readErr != nil {
		err = readErr
		return
	}
	if os.IsNotExist(err) && comments.SourceSnapshot != nil {
		markdown, err = *comments.SourceSnapshot, nil
	}
	return
}
