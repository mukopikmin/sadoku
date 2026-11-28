package model

import (
	"unicode"
	"unicode/utf8"
)

type Document struct {
	ID           int64   `json:"id"`
	FilePath     string  `json:"filePath,omitempty"`
	RelativePath string  `json:"relativePath"`
	Title        string  `json:"title"`
	DisplayTitle *string `json:"displayTitle,omitempty"`
	Deleted      bool    `json:"deleted"`
	Tags         []Tag   `json:"tags"`
}
type RegisteredDocument struct {
	Document
	HasSnapshot bool
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
type TagPatch struct {
	Name, BackgroundColor *string
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
	Version                int64     `json:"-"` // Storage version used to reject stale writes.
	FilePath               string    `json:"filePath"`
	Comments               []Comment `json:"comments"`
	SourceSnapshot         *string   `json:"-"`
	PreviousSourceSnapshot *string   `json:"-"`
	GitHubHeadSHA          string    `json:"githubHeadSha,omitempty"`
}

func ValidateTagName(value string) error {
	name := TrimSpace(value)
	if name == "" {
		return &RuleError{InvalidInput, "Tag name must not be empty."}
	}
	for _, r := range name {
		if unicode.IsControl(r) {
			return &RuleError{InvalidInput, "Tag name must not contain control characters."}
		}
	}
	if utf8.RuneCountInString(name) > 50 {
		return &RuleError{InvalidInput, "Tag name must not exceed 50 characters."}
	}
	return nil
}
