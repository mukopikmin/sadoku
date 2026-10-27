package session

import (
	"context"
	"maps"

	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

// Capture the request's immutable source and release Mu during GitHub I/O.
// Local edits and head monitoring must remain available while export is pending.
func (s *Session) exportOutsideLock(ctx context.Context, doc u.Document, in Input) (any, error) {
	pull := *s.GitHub
	view := &Session{Repository: s.Repository, Sources: maps.Clone(s.Sources), CommentIDs: maps.Clone(s.CommentIDs), GitHub: &pull, ReadRemote: s.ReadRemote}
	assertTarget := func() error {
		s.Mu.Lock()
		defer s.Mu.Unlock()
		current, err := s.Find(doc.ID)
		if err != nil || current.Deleted {
			return exportFailure("export_unavailable")
		}
		if current.RelativePath != doc.RelativePath || s.Sources[doc.ID] != view.Sources[doc.ID] {
			return exportFailure("export_out_of_sync")
		}
		return nil
	}
	s.Mu.Unlock()
	defer s.Mu.Lock()
	return view.exportComment(ctx, doc, in, assertTarget)
}
