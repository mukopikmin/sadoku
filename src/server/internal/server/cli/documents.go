package cli

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/mukopikmin/sadoku/internal/server/session"
	"github.com/mukopikmin/sadoku/internal/server/storage"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

// Nil means omitted; a pointer to nil or an empty slice explicitly clears it.
func documentAttributes(o Options) (**string, *[]int64, error) {
	var title **string
	if text, ok := o.Values["title"]; ok {
		if strings.ContainsAny(text, "\r\n\x00") {
			return nil, nil, usageError("--title must be a single line without null characters.")
		}
		var value *string
		if text = u.TrimSpace(text); text != "" {
			value = &text
		}
		title = &value
	}
	var tags *[]int64
	if text, ok := o.Values["tags"]; ok {
		ids := []int64{}
		seen := map[int64]bool{}
		if text != "" {
			for _, word := range strings.Split(text, ",") {
				id, err := number(word, "Tag ID", 1)
				if err != nil {
					return nil, nil, usageError("--tags must be comma-separated positive safe integer IDs, or an empty string.")
				}
				if !seen[id] {
					ids = append(ids, id)
					seen[id] = true
				}
			}
		}
		if len(ids) > 20 {
			return nil, nil, usageError("A document can have at most 20 tags.")
		}
		tags = &ids
	}
	return title, tags, nil
}

func addDocument(ctx context.Context, repo *storage.Repository, source string, o Options, out io.Writer) error {
	title, tags, err := documentAttributes(o)
	if err != nil {
		return err
	}
	identity, path, remote := session.Source(source)
	var doc u.Document
	if o.Flags["create"] {
		if remote || u.TrimSpace(source) == "" || strings.HasSuffix(source, "/") || strings.HasSuffix(source, "\\") || filepath.Base(source) == "." || filepath.Base(source) == ".." {
			return fmt.Errorf("--create requires a local Markdown filename.")
		}
		// Check tag references before creating a file that cannot be rolled back.
		if tags != nil {
			known, err := repo.Tags(0)
			if err != nil {
				return err
			}
			ids := map[int64]bool{}
			for _, tag := range known {
				ids[tag.ID] = true
			}
			for _, id := range *tags {
				if !ids[id] {
					return fmt.Errorf("Tag %d not found.", id)
				}
			}
		}
		// Creation adds the default extension before registering the document.
		filename := filepath.Base(path)
		if !strings.Contains(filename, ".") {
			filename += ".md"
		}
		if existing, found, err := repo.FindDocument(filepath.Join(filepath.Dir(path), filename)); err != nil {
			return err
		} else if found {
			return fmt.Errorf("Document is already registered: %d. Use `sadoku document update %d` to change its attributes.", existing.ID, existing.ID)
		}
		s := &session.Session{Root: filepath.Dir(path), CanCreate: true, Repository: repo, Sources: map[int64]string{}}
		result, err := s.Invoke(ctx, "CreateDocument", session.Input{Filename: filepath.Base(source), Title: o.Values["title"]})
		if err != nil {
			return documentError(err)
		}
		doc = result.(u.Document)
		if tags != nil {
			doc, err = repo.UpdateDocumentAttributes(doc.ID, nil, tags)
			if err != nil {
				return err
			}
		}
	} else {
		doc, err = repo.RegisterDocument(identity, title, tags)
		if err != nil {
			return err
		}
	}
	// Preserve add's existing output unless tag state was explicitly requested.
	return printJSON(out, documentOutput(doc, tags != nil))
}
