package session

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/mukopikmin/sadoku/internal/server/config"
	"github.com/mukopikmin/sadoku/internal/server/model"
	"github.com/mukopikmin/sadoku/internal/server/usecase"
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

type directoryDiscovery struct {
	documents        []model.Document
	pendingSnapshots []model.Document
	status           DirectoryStatus
}

// Prepare runs only after the listener is available. Directory registration
// publishes ready before the bounded snapshot queue reads any Markdown bodies.
func (s *Session) Prepare(ctx context.Context, settings config.Settings) {
	if s.directoryStatus != nil {
		result, err := s.discoverDirectory(ctx, settings, nil, func(progress DirectoryStatus) {
			s.Mu.Lock()
			s.directoryStatus = &progress
			s.Mu.Unlock()
		})
		s.Mu.Lock()
		s.directoryConfig = settings
		if err != nil {
			name := "Error"
			switch {
			case errors.Is(err, context.Canceled):
				name = "AbortError"
			case errors.Is(err, os.ErrNotExist):
				name = "NotFound"
			case errors.Is(err, os.ErrPermission):
				name = "PermissionDenied"
			}
			result.status.State = "error"
			result.status.Error = &DirectoryError{Name: name, Message: err.Error()}
			s.directoryStatus = &result.status
			s.Mu.Unlock()
			return
		}
		s.publishDirectory(result.documents, result.status)
		s.Mu.Unlock()
	}
	s.InitializeSnapshots(ctx)
}

func (s *Session) ReloadDocuments(ctx context.Context) error {
	s.Mu.Lock()
	if s.directoryStatus == nil || s.directoryStatus.State == "loading" {
		s.Mu.Unlock()
		return usecase.Fail("failed_precondition", "Reloading documents is unavailable in this preview.")
	}
	result, err := s.discoverDirectory(ctx, s.directoryConfig, s.createdPaths, nil)
	if err == nil {
		s.publishDirectory(result.documents, result.status)
	}
	s.Mu.Unlock()
	if err != nil {
		return usecase.Fail("internal", "Could not rescan the open folder: "+err.Error())
	}
	sources := make(map[int64]string, len(result.pendingSnapshots))
	for _, document := range result.pendingSnapshots {
		sources[document.ID] = document.FilePath
	}
	s.initializeSnapshots(ctx, result.pendingSnapshots, sources, ReadMarkdown)
	return nil
}

func (s *Session) discoverDirectory(ctx context.Context, settings config.Settings, created map[string]struct{}, report func(DirectoryStatus)) (directoryDiscovery, error) {
	result := directoryDiscovery{status: DirectoryStatus{State: "loading"}}
	paths := []string{}
	if err := scan(ctx, s.Root, settings, created, 0, &paths); err != nil {
		return result, err
	}
	remaining := settings.MaxFiles - len(paths)
	// Include files explicitly created in the preview, even outside discovery limits.
	for path := range created {
		if SafeLocal(s.Root, path, false) == nil {
			paths = append(paths, path)
		}
	}
	sortRegistrationPaths(paths)
	if err := ctx.Err(); err != nil {
		return result, err
	}
	result.status.Detected = len(paths)
	if report != nil {
		report(result.status)
	}
	registrations, err := s.Repository.EnsureMany(ctx, paths)
	if err != nil {
		return result, err
	}
	result.status.Registered = len(registrations)
	if report != nil {
		report(result.status)
	}
	if err = ctx.Err(); err != nil {
		return result, err
	}
	result.documents = make([]model.Document, 0, len(registrations))
	registered := make(map[int64]bool, len(registrations))
	for _, registration := range registrations {
		doc := s.directoryDocument(registration.Document)
		registered[doc.ID] = true
		result.documents = append(result.documents, doc)
		if !registration.HasSnapshot {
			result.pendingSnapshots = append(result.pendingSnapshots, doc)
		}
	}
	stored, err := s.Repository.Documents(ctx)
	if err != nil {
		return result, err
	}
	for _, d := range stored {
		if err = ctx.Err(); err != nil {
			return result, err
		}
		if remaining <= 0 && len(created) == 0 {
			break
		}
		_, explicit := created[d.FilePath]
		if (!explicit && remaining <= 0) || registered[d.ID] || !filepath.IsAbs(d.FilePath) || !Within(s.Root, d.FilePath) {
			continue
		}
		if _, err := os.Stat(d.FilePath); !os.IsNotExist(err) {
			continue
		}
		d.Deleted = true
		result.documents = append(result.documents, s.directoryDocument(d))
		if !explicit {
			remaining--
		}
	}
	sortDocuments(result.documents)
	if err = ctx.Err(); err != nil {
		return result, err
	}
	result.status.State = "ready"
	return result, nil
}

func (s *Session) directoryDocument(doc model.Document) model.Document {
	rel, _ := filepath.Rel(s.Root, doc.FilePath)
	doc.RelativePath = filepath.ToSlash(rel)
	doc.Title = filepath.Base(doc.FilePath)
	doc.Tags = []model.Tag{}
	return doc
}

// The caller holds Mu so readers see the documents and their sources together.
func (s *Session) publishDirectory(documents []model.Document, status DirectoryStatus) {
	s.Documents = documents
	s.Sources = make(map[int64]string, len(documents))
	for _, d := range documents {
		s.Sources[d.ID] = d.FilePath
	}
	s.directoryStatus = &status
}

type SnapshotProgress struct{ Target, Completed, Failed int }

// InitializeSnapshots uses one reader at a time and never holds the session
// mutex over filesystem/network I/O. Failed files do not stop later files.
func (s *Session) InitializeSnapshots(ctx context.Context) SnapshotProgress {
	s.Mu.Lock()
	documents := append([]model.Document{}, s.Documents...)
	sources := map[int64]string{}
	for id, source := range s.Sources {
		sources[id] = source
	}
	read := s.ReadRemote
	if read == nil {
		read = ReadMarkdown
	}
	s.Mu.Unlock()
	return s.initializeSnapshots(ctx, documents, sources, read)
}

func (s *Session) initializeSnapshots(ctx context.Context, documents []model.Document, sources map[int64]string, read func(context.Context, string) (string, error)) SnapshotProgress {
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
			err = s.Repository.InitializeSnapshot(ctx, d.ID, markdown)
		}
		if err != nil {
			progress.Failed++
		} else {
			progress.Completed++
		}
	}
	return progress
}

func scan(ctx context.Context, root string, settings config.Settings, skip map[string]struct{}, depth int, paths *[]string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	directory, err := os.Open(root)
	if err != nil {
		return err
	}
	entries, err := directory.ReadDir(-1)
	_ = directory.Close()
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
				if err := scan(ctx, path, settings, skip, depth+1, paths); err != nil {
					return err
				}
			}
			continue
		}
		if _, skipped := skip[path]; skipped {
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
