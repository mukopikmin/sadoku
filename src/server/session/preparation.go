package session

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/mukopikmin/sadoku/src/server/config"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

type DirectoryError struct {
	Name    string `json:"name"`
	Message string `json:"message"`
}
type DirectoryStatus struct {
	State      string          `json:"state"`
	Detected   int             `json:"detected"`
	Registered int             `json:"registered"`
	Error      *DirectoryError `json:"error,omitempty"`
}

// Prepare runs only after the listener is available. Directory registration
// publishes ready before the bounded snapshot queue reads any Markdown bodies.
func (s *Session) Prepare(ctx context.Context, settings config.Settings) {
	if s.directoryStatus != nil {
		if err := s.prepareDirectory(ctx, settings); err != nil {
			name := "Error"
			switch {
			case errors.Is(err, context.Canceled):
				name = "AbortError"
			case errors.Is(err, os.ErrNotExist):
				name = "NotFound"
			case errors.Is(err, os.ErrPermission):
				name = "PermissionDenied"
			}
			s.Mu.Lock()
			status := *s.directoryStatus
			status.State = "error"
			status.Error = &DirectoryError{Name: name, Message: err.Error()}
			s.directoryStatus = &status
			s.Mu.Unlock()
			return
		}
	}
	s.InitializeSnapshots(ctx)
}
func (s *Session) prepareDirectory(ctx context.Context, settings config.Settings) error {
	paths := []string{}
	if err := scan(ctx, s.Root, settings, 0, &paths); err != nil {
		return err
	}
	sort.Strings(paths)
	if err := ctx.Err(); err != nil {
		return err
	}
	s.Mu.Lock()
	s.directoryStatus.Detected = len(paths)
	s.Mu.Unlock()
	documents, err := s.Repository.EnsureMany(ctx, paths)
	if err != nil {
		return err
	}
	s.Mu.Lock()
	s.directoryStatus.Registered = len(documents)
	s.Mu.Unlock()
	if err = ctx.Err(); err != nil {
		return err
	}
	for i := range documents {
		rel, _ := filepath.Rel(s.Root, documents[i].FilePath)
		documents[i].RelativePath = filepath.ToSlash(rel)
		documents[i].Title = filepath.Base(documents[i].FilePath)
		documents[i].Tags = []u.Tag{}
	}
	stored, err := s.Repository.DocumentsContext(ctx)
	if err != nil {
		return err
	}
	for _, d := range stored {
		if err = ctx.Err(); err != nil {
			return err
		}
		if len(documents) >= settings.MaxFiles {
			break
		}
		if !filepath.IsAbs(d.FilePath) || !Within(s.Root, d.FilePath) {
			continue
		}
		if _, err := os.Stat(d.FilePath); !os.IsNotExist(err) {
			continue
		}
		d.Deleted = true
		rel, _ := filepath.Rel(s.Root, d.FilePath)
		d.RelativePath = filepath.ToSlash(rel)
		d.Title = filepath.Base(d.FilePath)
		d.Tags = []u.Tag{}
		documents = append(documents, d)
	}
	sort.Slice(documents, func(i, j int) bool { return documents[i].RelativePath < documents[j].RelativePath })
	if err = ctx.Err(); err != nil {
		return err
	}
	s.Mu.Lock()
	defer s.Mu.Unlock()
	s.Documents = documents
	for _, d := range documents {
		s.Sources[d.ID] = d.FilePath
	}
	s.directoryStatus = &DirectoryStatus{State: "ready", Detected: s.directoryStatus.Detected, Registered: s.directoryStatus.Registered}
	return nil
}

type SnapshotProgress struct{ Target, Completed, Failed int }

// InitializeSnapshots uses one reader at a time and never holds the session
// mutex over filesystem/network I/O. Failed files do not stop later files.
func (s *Session) InitializeSnapshots(ctx context.Context) SnapshotProgress {
	s.Mu.Lock()
	documents := append([]u.Document{}, s.Documents...)
	sources := map[int64]string{}
	for id, source := range s.Sources {
		sources[id] = source
	}
	read := s.ReadRemote
	if read == nil {
		read = ReadMarkdown
	}
	s.Mu.Unlock()
	progress := SnapshotProgress{}
	for _, d := range documents {
		if !d.Deleted {
			progress.Target++
		}
	}
	for _, d := range documents {
		if ctx.Err() != nil {
			break
		}
		if d.Deleted {
			continue
		}
		markdown, err := read(ctx, sources[d.ID])
		if err == nil {
			err = s.Repository.InitializeSnapshotContext(ctx, d.ID, markdown)
		}
		if err != nil {
			progress.Failed++
		} else {
			progress.Completed++
		}
	}
	return progress
}

func scan(ctx context.Context, root string, settings config.Settings, depth int, paths *[]string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return err
		}
		if len(*paths) >= settings.MaxFiles {
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 {
			continue
		}
		path := filepath.Join(root, entry.Name())
		if entry.IsDir() {
			excluded := false
			for _, name := range settings.ExcludedDirectories {
				if entry.Name() == name {
					excluded = true
				}
			}
			if !excluded && depth < settings.MaxDepth {
				if err := scan(ctx, path, settings, depth+1, paths); err != nil {
					return err
				}
			}
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			continue
		}
		for _, extension := range settings.MarkdownExtensions {
			if strings.EqualFold(filepath.Ext(entry.Name()), extension) {
				*paths = append(*paths, path)
				break
			}
		}
	}
	return ctx.Err()
}
