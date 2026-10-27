package session

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mukopikmin/sadoku/src/server/config"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
	whatwg "github.com/nlnwa/whatwg-url/url"
	"golang.org/x/text/encoding/unicode"
)

type Session struct {
	Mu              sync.Mutex
	Root            string
	Documents       []u.Document
	Sources         map[int64]string
	CommentIDs      map[int64]int64
	CanCreate       bool
	PullRequest     any
	GitHub          *Pull
	Repository      u.Repository
	invalidations   map[chan struct{}]struct{}
	exporting       atomic.Bool
	restoring       sync.Map
	directoryStatus *DirectoryStatus
	ReadRemote      func(context.Context, string) (string, error)
}

func (s *Session) ExportInProgress() bool { return s.exporting.Load() }

func Source(input string) (identity, fetch string, remote bool) {
	parsed := parseHTTPURL(input)
	if parsed != nil {
		if pull := parsePullURL(parsed); pull != nil {
			return pull.URL, pull.URL, true
		}
		full := parsed.Href(false)
		parsed.SetSearch("")
		parsed.SetHash("")
		return parsed.Href(false), full, true
	}
	abs, _ := filepath.Abs(input)
	return abs, abs, false
}

// Persistent identities must follow JavaScript URL rules, including IDNA,
// default ports, escaped dot segments, and special-scheme URL syntax.
func parseHTTPURL(input string) *whatwg.Url {
	parsed, err := whatwg.Parse(input)
	if err != nil || parsed == nil || (parsed.Scheme() != "http" && parsed.Scheme() != "https") {
		return nil
	}
	return parsed
}

var errRedirectLimit = errors.New("Fetch failed: Maximum number of redirects (20) reached")

func ReadMarkdown(ctx context.Context, source string) (string, error) {
	_, fetch, remote := Source(source)
	if !remote {
		b, err := os.ReadFile(source)
		return decodeText(b, false), err
	}
	req, err := http.NewRequestWithContext(ctx, "GET", fetch, nil)
	if err != nil {
		return "", err
	}
	client := &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(_ *http.Request, via []*http.Request) error {
		if len(via) > 20 {
			return errRedirectLimit
		}
		return nil
	}}
	resp, err := client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		if errors.Is(err, errRedirectLimit) {
			return "", errRedirectLimit
		}
		return "", fmt.Errorf("fetch failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Failed to fetch Markdown URL: %s", strings.TrimRight(resp.Status, " \t\r\n"))
	}
	if resp.StatusCode == 204 || resp.StatusCode == 205 {
		return "", nil
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, (32<<20)+1))
	if err == nil && len(b) > 32<<20 {
		return "", fmt.Errorf("remote Markdown exceeds 32 MiB")
	}
	return decodeText(b, true), err
}

func decodeText(data []byte, remote bool) string {
	decoder := unicode.UTF8.NewDecoder()
	if remote {
		decoder = unicode.UTF8BOM.NewDecoder()
	}
	text, _ := decoder.Bytes(data)
	return string(text)
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
			parsed := parseHTTPURL(identity)
			d.RelativePath = path.Base(parsed.Pathname())
		}
		d.Title = d.RelativePath
		d.Tags = []u.Tag{}
		s.Documents = append(s.Documents, d)
		s.Sources[d.ID] = source
	} else {
		s.Root = source
		s.CanCreate = true
		s.directoryStatus = &DirectoryStatus{State: "loading"}
	}
	return s, nil
}

func Within(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != "." && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && !filepath.IsAbs(rel)
}
func (s *Session) Find(id int64) (u.Document, error) {
	if err := u.PositiveID(id); err != nil {
		return u.Document{}, u.Fail("not_found", "Document not found.")
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

// Called with Mu held: capture the immutable source before letting other
// requests proceed, and restore the lock before touching session state again.
func (s *Session) readOutsideLock(ctx context.Context, source string) (string, error) {
	read := s.ReadRemote
	if read == nil {
		read = ReadMarkdown
	}
	s.Mu.Unlock()
	defer s.Mu.Lock()
	return read(ctx, source)
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

// GitHub document registration and comment storage have separate identities.
// Read a missing comment identity without creating a persistent document row.
func (s *Session) commentStorage(id int64, create bool) (int64, string, error) {
	identity, _, _ := Source(s.Sources[id])
	if s.GitHub == nil {
		return id, identity, nil
	}
	if mapped := s.CommentIDs[id]; mapped != 0 {
		return mapped, identity, nil
	}
	document, found, err := s.Repository.FindDocument(identity)
	if err != nil {
		return 0, identity, err
	}
	if !found && create {
		document, err = s.Repository.Ensure(identity)
		found = err == nil
	}
	if found {
		if s.CommentIDs == nil {
			s.CommentIDs = map[int64]int64{}
		}
		s.CommentIDs[id] = document.ID
		return document.ID, identity, nil
	}
	return 0, identity, err
}

func (s *Session) readComments(id int64) (u.Comments, error) {
	storageID, identity, err := s.commentStorage(id, false)
	if err != nil {
		return u.Comments{}, err
	}
	if storageID == 0 {
		return u.Comments{FilePath: identity, Comments: []u.Comment{}}, nil
	}
	return s.Repository.ReadComments(storageID)
}

func (s *Session) saveComments(id int64, comments u.Comments) error {
	storageID, _, err := s.commentStorage(id, true)
	if err != nil {
		return err
	}
	return s.Repository.SaveComments(storageID, comments)
}
