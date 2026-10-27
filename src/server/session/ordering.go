package session

import (
	"path/filepath"
	"slices"
	"sort"
	"unicode/utf16"

	u "github.com/mukopikmin/sadoku/src/server/usecase"
	"golang.org/x/text/collate"
	"golang.org/x/text/language"
)

// Discovery registered files in JavaScript UTF-16 order, then displayed session
// documents in the default English locale order. Keep those two orders distinct.
func sortRegistrationPaths(paths []string) {
	sort.SliceStable(paths, func(i, j int) bool {
		return slices.Compare(utf16.Encode([]rune(filepath.ToSlash(paths[i]))), utf16.Encode([]rune(filepath.ToSlash(paths[j])))) < 0
	})
}
func sortDocuments(documents []u.Document) {
	comparator := collate.New(language.English)
	sort.SliceStable(documents, func(i, j int) bool {
		return comparator.CompareString(documents[i].RelativePath, documents[j].RelativePath) < 0
	})
}
