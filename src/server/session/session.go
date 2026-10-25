package session

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/mukopikmin/sadoku/src/server/config"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

type Session struct {
	Mu            sync.Mutex
	Root          string
	Documents     []u.Document
	Sources       map[int64]string
	CommentIDs    map[int64]int64
	CanCreate     bool
	PullRequest   any
	GitHub        *Pull
	Repository    u.Repository
	invalidations map[chan struct{}]struct{}
	ReadRemote    func(context.Context, string) (string, error)
}

func Source(input string) (identity, fetch string, remote bool) {
	parsed, err := url.Parse(input)
	if err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") {
		full := parsed.String()
		parsed.RawQuery = ""
		parsed.Fragment = ""
		return parsed.String(), full, true
	}
	abs, _ := filepath.Abs(input)
	return abs, abs, false
}
func ReadMarkdown(ctx context.Context, source string) (string, error) {
	_, _, remote := Source(source)
	if !remote {
		b, err := os.ReadFile(source)
		return string(b), err
	}
	req, err := http.NewRequestWithContext(ctx, "GET", source, nil)
	if err != nil {
		return "", err
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("failed to fetch Markdown URL: %s", resp.Status)
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, (32<<20)+1))
	if err == nil && len(b) > 32<<20 {
		return "", fmt.Errorf("remote Markdown exceeds 32 MiB")
	}
	return string(b), err
}
func New(ctx context.Context, input string, repo u.Repository, settings config.Settings) (*Session, error) {
	s := &Session{Repository: repo, Sources: map[int64]string{}, Documents: []u.Document{}}
	if pull := ParsePull(input); pull != nil {
		if err := s.preparePull(ctx, pull, settings); err != nil {
			return nil, err
		}
		return s, nil
	}
	identity, source, remote := Source(input)
	info, err := os.Stat(source)
	if !remote && err != nil {
		return nil, err
	}
	if remote || !info.IsDir() {
		s.Root = filepath.Dir(identity)
		d, err := repo.Ensure(identity)
		if err != nil {
			return nil, err
		}
		d.RelativePath = filepath.Base(identity)
		if remote {
			parsed, _ := url.Parse(identity)
			d.RelativePath = filepath.Base(parsed.Path)
		}
		d.Title = d.RelativePath
		d.Tags = []u.Tag{}
		s.Documents = append(s.Documents, d)
		s.Sources[d.ID] = source
	} else {
		s.Root = source
		s.CanCreate = true
		var paths []string
		err := scan(source, settings, 0, &paths)
		if err != nil {
			return nil, err
		}
		sort.Strings(paths)
		for _, path := range paths {
			d, err := repo.Ensure(path)
			if err != nil {
				return nil, err
			}
			rel, _ := filepath.Rel(source, path)
			d.RelativePath = filepath.ToSlash(rel)
			d.Title = filepath.Base(path)
			d.Tags = []u.Tag{}
			s.Documents = append(s.Documents, d)
			s.Sources[d.ID] = path
		}
		stored, err := repo.Documents()
		if err != nil {
			return nil, err
		}
		for _, d := range stored {
			if len(s.Documents) >= settings.MaxFiles {
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
			s.Documents = append(s.Documents, d)
			s.Sources[d.ID] = d.FilePath
		}
	}
	sort.Slice(s.Documents, func(i, j int) bool { return s.Documents[i].RelativePath < s.Documents[j].RelativePath })
	for _, d := range s.Documents {
		if d.Deleted {
			continue
		}
		markdown, err := s.Read(ctx, d.ID)
		if err != nil {
			return nil, err
		}
		if err = repo.InitializeSnapshot(d.ID, markdown); err != nil {
			return nil, err
		}
	}
	return s, nil
}
func scan(root string, settings config.Settings, depth int, paths *[]string) error {
	entries, err := os.ReadDir(root)
	if err != nil {
		return err
	}
	for _, entry := range entries {
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
				if err = scan(path, settings, depth+1, paths); err != nil {
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
	return nil
}
func Within(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != "." && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && !filepath.IsAbs(rel)
}
func (s *Session) Find(id int64) (u.Document, error) {
	if err := u.PositiveID(id); err != nil {
		return u.Document{}, err
	}
	for _, d := range s.Documents {
		if d.ID == id {
			return d, nil
		}
	}
	return u.Document{}, u.Fail("not_found", "Document not found.")
}
func (s *Session) Read(ctx context.Context, id int64) (string, error) {
	source, ok := s.Sources[id]
	if !ok {
		return "", u.Fail("not_found", "Document not found.")
	}
	if s.ReadRemote != nil {
		return s.ReadRemote(ctx, source)
	}
	return ReadMarkdown(ctx, source)
}

// ResolveLocal canonicalizes the selected root and rejects symbolic links below it.
func ResolveLocal(root, path string, allowMissing bool) (string, error) {
	if !Within(root, path) {
		return "", u.Fail("failed_precondition", "Choose a local file inside the open folder without symbolic links.")
	}
	realRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}
	relative, err := filepath.Rel(root, path)
	if err != nil {
		return "", err
	}
	destination := filepath.Join(realRoot, relative)
	current := realRoot
	parts := strings.Split(relative, string(filepath.Separator))
	for i, part := range parts {
		current = filepath.Join(current, part)
		info, err := os.Lstat(current)
		if allowMissing && i == len(parts)-1 && os.IsNotExist(err) {
			return destination, nil
		}
		if err != nil {
			return "", err
		}
		if info.Mode()&os.ModeSymlink != 0 || (i < len(parts)-1 && !info.IsDir()) || (i == len(parts)-1 && !info.Mode().IsRegular()) {
			return "", u.Fail("failed_precondition", "Choose a local file inside the open folder without symbolic links.")
		}
	}
	return destination, nil
}
func SafeLocal(root, path string, allowMissing bool) error {
	_, err := ResolveLocal(root, path, allowMissing)
	return err
}

func (s *Session) CommentDocumentID(id int64) int64 {
	if mapped := s.CommentIDs[id]; mapped != 0 {
		return mapped
	}
	return id
}
