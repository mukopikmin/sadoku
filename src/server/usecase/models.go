package usecase

import (
	"context"
	"fmt"
	"unicode"
	"unicode/utf8"
)

type Failure struct{ Kind, Message string }

func (e *Failure) Error() string      { return e.Message }
func Fail(kind, message string) error { return &Failure{kind, message} }

type Document struct {
	ID           int64   `json:"id"`
	FilePath     string  `json:"filePath,omitempty"`
	RelativePath string  `json:"relativePath"`
	Title        string  `json:"title"`
	DisplayTitle *string `json:"displayTitle,omitempty"`
	Deleted      bool    `json:"deleted"`
	Tags         []Tag   `json:"tags"`
}
type Revision struct {
	ID               int64   `json:"id"`
	RecordedAt       string  `json:"recordedAt"`
	Markdown         string  `json:"markdown"`
	PreviousMarkdown *string `json:"previousMarkdown,omitempty"`
}
type Tag struct {
	ID              int64  `json:"id"`
	Name            string `json:"name"`
	BackgroundColor string `json:"backgroundColor"`
	DocumentCount   int64  `json:"documentCount"`
	CreatedAt       string `json:"createdAt,omitempty"`
	UpdatedAt       string `json:"updatedAt,omitempty"`
}
type TagReference struct {
	ID   int64
	Name string
}
type Note struct {
	ID         int64  `json:"id"`
	DocumentID int64  `json:"documentId,omitempty"`
	Content    string `json:"content"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}
type Author struct {
	Type string `json:"type"`
}
type Reply struct {
	ID              int64  `json:"id"`
	Author          Author `json:"author"`
	Body            string `json:"body"`
	CreatedAt       string `json:"createdAt"`
	UpdatedAt       string `json:"updatedAt"`
	ReviewRequested bool   `json:"reviewRequested,omitempty"`
}
type Comment struct {
	ID                int64   `json:"id"`
	Author            Author  `json:"author"`
	Body              string  `json:"body"`
	StartLine         int     `json:"startLine"`
	EndLine           int     `json:"endLine"`
	OriginalStartLine int     `json:"originalStartLine"`
	OriginalEndLine   int     `json:"originalEndLine"`
	CreatedAt         string  `json:"createdAt"`
	UpdatedAt         string  `json:"updatedAt"`
	Resolved          bool    `json:"resolved"`
	Stale             bool    `json:"stale"`
	ResolvedAt        *string `json:"resolvedAt,omitempty"`
	ResolvedBy        *Author `json:"resolvedBy,omitempty"`
	SourceHash        *string `json:"sourceHash,omitempty"`
	SourceText        *string `json:"sourceText,omitempty"`
	Replies           []Reply `json:"replies"`
	DisplayLine       int     `json:"displayLine,omitempty"`
	CurrentSourceText *string `json:"currentSourceText,omitempty"`
	SourceDeleted     bool    `json:"sourceDeleted,omitempty"`
}
type Comments struct {
	FilePath               string    `json:"filePath"`
	Comments               []Comment `json:"comments"`
	SourceSnapshot         *string   `json:"-"`
	PreviousSourceSnapshot *string   `json:"-"`
	GitHubHeadSHA          string    `json:"githubHeadSha,omitempty"`
}

// Repository is the persistence port shared by HTTP and command-line use cases.
type Repository interface {
	Ensure(string) (Document, error)
	EnsureMany(context.Context, []string) ([]Document, error)
	DocumentsContext(context.Context) ([]Document, error)
	InitializeSnapshotContext(context.Context, int64, string) error
	Documents() ([]Document, error)
	SetTitle(int64, *string) error
	Snapshot(int64) (*string, *string, error)
	SaveComments(int64, Comments) error
	ReadComments(int64) (Comments, error)
	CommentsNotificationPath(int64) (string, error)
	Revisions(int64) ([]Revision, error)
	Revision(int64, int64) (Revision, error)
	RecordRevision(int64, string) error
	InitializeSnapshot(int64, string) error
	Tags(int64) ([]Tag, error)
	SaveTag(Tag) (Tag, error)
	DeleteTag(int64) error
	ReplaceTags(int64, []int64) error
	ReplaceTagReferences(int64, []TagReference) ([]Tag, error)
	Notes(string, int64) ([]Note, error)
	SaveNote(string, Note) (Note, error)
	DeleteNote(string, int64, int64) error
	Statistics() (any, error)
}

func PositiveID(id int64) error {
	if id < 1 || id > 9007199254740991 {
		return Fail("not_found", fmt.Sprintf("Invalid resource ID: %d.", id))
	}
	return nil
}

func ValidTagName(name string) bool {
	if name == "" || utf8.RuneCountInString(name) > 50 {
		return false
	}
	for _, r := range name {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}
