package usecase

import (
	"fmt"
	"strings"
	"unicode"
	"unicode/utf16"
)

// HashSource matches JavaScript's FNV-1a over UTF-16 code units, including emoji.
func HashSource(text string) string {
	hash := uint32(0x811c9dc5)
	for _, unit := range utf16.Encode([]rune(text)) {
		hash ^= uint32(unit)
		hash *= 0x01000193
	}
	return fmt.Sprintf("%08x", hash)
}
func RangeText(markdown string, start, end int) *string {
	lines := strings.Split(markdown, "\n")
	if start < 1 || end < start || end > len(lines) {
		return nil
	}
	text := strings.Join(lines[start-1:end], "\n")
	return &text
}

type lineRange struct{ start, end int }

// mapLines uses the same longest-common-subsequence tie breaking as the old server.
func mapLines(before, after string) map[int]lineRange {
	old, new := strings.Split(before, "\n"), strings.Split(after, "\n")
	width := len(new) + 1
	lengths := make([]uint32, (len(old)+1)*width)
	for i := len(old) - 1; i >= 0; i-- {
		for j := len(new) - 1; j >= 0; j-- {
			if old[i] == new[j] {
				lengths[i*width+j] = lengths[(i+1)*width+j+1] + 1
			} else {
				lengths[i*width+j] = max(lengths[(i+1)*width+j], lengths[i*width+j+1])
			}
		}
	}
	type match struct{ old, new int }
	matches := []match{}
	i, j := 0, 0
	for i < len(old) && j < len(new) {
		if old[i] == new[j] {
			matches = append(matches, match{i, j})
			i++
			j++
		} else if lengths[(i+1)*width+j] >= lengths[i*width+j+1] {
			i++
		} else {
			j++
		}
	}
	matches = append(matches, match{len(old), len(new)})
	result := map[int]lineRange{}
	prevOld, prevNew := -1, -1
	for _, m := range matches {
		if prevOld+1 <= m.old-1 && prevNew+1 <= m.new-1 {
			changed := mapChangedLines(old[prevOld+1:m.old], new[prevNew+1:m.new])
			for n := prevOld + 1; n < m.old; n++ {
				r, ok := changed[n-prevOld]
				if ok {
					result[n+1] = lineRange{prevNew + 1 + r.start, prevNew + 1 + r.end}
				} else if changed == nil {
					result[n+1] = lineRange{prevNew + 2, m.new}
				}
			}
		}
		if m.old < len(old) {
			result[m.old+1] = lineRange{m.new + 1, m.new + 1}
		}
		prevOld, prevNew = m.old, m.new
	}
	return result
}

// Refine replacement hunks by matching characters, so adjacent edited lines do
// not all inherit the entire hunk. A line can still span multiple new lines
// when a paragraph is rewrapped. Unmatched lines use the replacement between
// their nearest matches; an empty replacement means deletion. Large rewrites
// retain the coarse mapping to bound refinement's memory and CPU cost.
func mapChangedLines(before, after []string) map[int]lineRange {
	if len(before) == 1 && len(after) == 1 {
		return nil
	}
	old, new := []rune(strings.Join(before, "\n")), []rune(strings.Join(after, "\n"))
	oldLines, newLines := runeLineNumbers(old), runeLineNumbers(new)
	result := map[int]lineRange{}
	type region struct{ oldStart, oldEnd, newStart, newEnd int }
	pending := []region{{0, len(old), 0, len(new)}}
	work := 1_000_000
	for len(pending) > 0 {
		r := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		oldLength, newLength := r.oldEnd-r.oldStart, r.newEnd-r.newStart
		if oldLength == 0 || newLength == 0 {
			continue
		}
		if oldLength > work/newLength {
			return nil
		}
		work -= oldLength * newLength
		// Anchor the longest contiguous surviving text first. Isolated shared
		// letters in a deleted neighbor must not steal the edited line's anchor.
		lengths := make([]int, newLength+1)
		bestOld, bestNew, longest := 0, 0, 0
		for i := r.oldEnd - 1; i >= r.oldStart; i-- {
			for j := r.newStart; j < r.newEnd; j++ {
				length := 0
				if old[i] == new[j] {
					length = lengths[j-r.newStart+1] + 1
				}
				lengths[j-r.newStart] = length
				if length > longest {
					bestOld, bestNew, longest = i, j, length
				}
			}
		}
		if longest == 0 {
			continue
		}
		for n := 0; n < longest; n++ {
			if unicode.IsSpace(old[bestOld+n]) {
				continue
			}
			oldLine, newLine := oldLines[bestOld+n], newLines[bestNew+n]
			mapped, ok := result[oldLine]
			if !ok {
				mapped = lineRange{newLine, newLine}
			} else {
				mapped.start, mapped.end = min(mapped.start, newLine), max(mapped.end, newLine)
			}
			result[oldLine] = mapped
		}
		pending = append(pending,
			region{r.oldStart, bestOld, r.newStart, bestNew},
			region{bestOld + longest, r.oldEnd, bestNew + longest, r.newEnd},
		)
	}
	prevOld, prevNew := 0, 0
	for line := 1; line <= len(before)+1; line++ {
		r, ok := result[line]
		if line == len(before)+1 {
			r.start, ok = len(after)+1, true
		}
		if !ok {
			continue
		}
		if prevNew+1 < r.start {
			for n := prevOld + 1; n < line; n++ {
				result[n] = lineRange{prevNew + 1, r.start - 1}
			}
		}
		prevOld, prevNew = line, r.end
	}
	return result
}

func runeLineNumbers(text []rune) []int {
	lines := make([]int, len(text))
	line := 1
	for i, char := range text {
		lines[i] = line
		if char == '\n' {
			line++
		}
	}
	return lines
}

func ResolveComments(doc Comments, markdown string) Comments {
	if doc.SourceSnapshot != nil && *doc.SourceSnapshot == markdown {
		for i := range doc.Comments {
			doc.Comments[i].DisplayLine = doc.Comments[i].StartLine
		}
		return currentText(doc, markdown)
	}
	var mapping map[int]lineRange
	if doc.SourceSnapshot != nil {
		mapping = mapLines(*doc.SourceSnapshot, markdown)
	}
	for i := range doc.Comments {
		c := &doc.Comments[i]
		c.DisplayLine = c.StartLine
		if mapping != nil {
			if c.Stale {
				continue
			}
			start, end := int(^uint(0)>>1), 0
			for line := c.StartLine; line <= c.EndLine; line++ {
				if r, ok := mapping[line]; ok {
					start = min(start, r.start)
					end = max(end, r.end)
				}
			}
			if end == 0 {
				c.Stale = true
				c.SourceDeleted = true
			} else {
				c.StartLine = start
				c.EndLine = end
				c.DisplayLine = start
			}
			continue
		}
		if c.SourceText == nil {
			c.SourceText = RangeText(markdown, c.StartLine, c.EndLine)
		}
		if c.SourceText == nil {
			empty := ""
			c.SourceText = &empty
		}
		if c.SourceHash == nil {
			hash := HashSource(*c.SourceText)
			c.SourceHash = &hash
		}
		c.OriginalStartLine = c.StartLine
		c.OriginalEndLine = c.EndLine
		count, start := 0, 0
		span := c.EndLine - c.StartLine
		for line := max(1, c.StartLine-40); line <= min(len(strings.Split(markdown, "\n")), c.StartLine+40); line++ {
			text := RangeText(markdown, line, line+span)
			if text != nil && *text == *c.SourceText && HashSource(*text) == *c.SourceHash {
				count++
				start = line
			}
		}
		c.Stale = count != 1
		if count == 1 {
			c.StartLine = start
			c.EndLine = start + span
			c.DisplayLine = start
		}
	}
	doc.PreviousSourceSnapshot = doc.SourceSnapshot
	doc.SourceSnapshot = &markdown
	return currentText(doc, markdown)
}
func currentText(doc Comments, markdown string) Comments {
	for i := range doc.Comments {
		c := &doc.Comments[i]
		c.CurrentSourceText = nil
		if !c.Stale {
			c.CurrentSourceText = RangeText(markdown, c.StartLine, c.EndLine)
		}
	}
	return doc
}

type CommentInput struct {
	CommentID, ReplyID             int64
	StartLine, EndLine             int
	Body                           string
	Resolved, AsBot, RequestReview bool
}

func ChangeComment(operation string, doc Comments, in CommentInput, markdown, now string) (Comments, any, error) {
	body := TrimSpace(in.Body)
	author := Author{Type: "human"}
	if in.AsBot {
		author.Type = "bot"
	}
	if operation == "CreateComment" {
		if body == "" {
			return doc, nil, Fail("invalid_argument", "Comment body is required.")
		}
		text := RangeText(markdown, in.StartLine, in.EndLine)
		if text == nil {
			return doc, nil, Fail("invalid_argument", "Comment range is outside the Markdown source.")
		}
		id := int64(1)
		for _, c := range doc.Comments {
			id = max(id, c.ID+1)
		}
		hash := HashSource(*text)
		c := Comment{ID: id, Author: author, Body: body, StartLine: in.StartLine, EndLine: in.EndLine, OriginalStartLine: in.StartLine, OriginalEndLine: in.EndLine, CreatedAt: now, UpdatedAt: now, SourceText: text, SourceHash: &hash, CurrentSourceText: text, Replies: []Reply{}}
		doc.Comments = append(doc.Comments, c)
		doc.SourceSnapshot = &markdown
		return doc, c, nil
	}
	index := -1
	for i, c := range doc.Comments {
		if c.ID == in.CommentID {
			index = i
			break
		}
	}
	if index < 0 {
		return doc, nil, Fail("not_found", "Comment not found.")
	}
	c := doc.Comments[index]
	switch operation {
	case "DeleteComment":
		doc.Comments = append(doc.Comments[:index], doc.Comments[index+1:]...)
		return doc, struct{}{}, nil
	case "UpdateComment":
		if body == "" {
			return doc, nil, Fail("invalid_argument", "Comment body is required.")
		}
		c.Body = body
	case "SetCommentResolution":
		c.Resolved = in.Resolved
		c.ResolvedAt = nil
		c.ResolvedBy = nil
		if in.Resolved {
			c.ResolvedAt = &now
			c.ResolvedBy = &author
		}
	case "CreateReply":
		if body == "" {
			return doc, nil, Fail("invalid_argument", "Reply body is required.")
		}
		if in.RequestReview && c.Resolved {
			return doc, nil, Fail("invalid_argument", "Cannot request review on a resolved comment.")
		}
		if in.RequestReview && !in.AsBot {
			return doc, nil, Fail("invalid_argument", "Review requests require a bot author.")
		}
		id := int64(1)
		for _, r := range c.Replies {
			id = max(id, r.ID+1)
		}
		c.Replies = append(c.Replies, Reply{ID: id, Author: author, Body: body, CreatedAt: now, UpdatedAt: now, ReviewRequested: in.RequestReview})
	case "UpdateReply", "DeleteReply":
		i := -1
		for n, r := range c.Replies {
			if r.ID == in.ReplyID {
				i = n
				break
			}
		}
		if i < 0 {
			return doc, nil, Fail("not_found", "Reply not found.")
		}
		if operation == "DeleteReply" {
			c.Replies = append(c.Replies[:i], c.Replies[i+1:]...)
		} else {
			if body == "" {
				return doc, nil, Fail("invalid_argument", "Reply body is required.")
			}
			c.Replies[i].Body = body
			c.Replies[i].UpdatedAt = now
		}
	default:
		return doc, nil, Fail("unimplemented", "Unknown comment operation.")
	}
	c.UpdatedAt = now
	doc.Comments[index] = c
	var result any = c
	if operation == "DeleteReply" {
		result = struct{}{}
	}
	return doc, result, nil
}

// TrimSpace follows ECMAScript String.trim, including BOM and excluding NEL.
// Persisted CLI bodies must match the text produced by the original runtime.
func TrimSpace(value string) string {
	return strings.TrimFunc(value, func(r rune) bool {
		return r == '\uFEFF' || r == '\u0009' || r == '\u000B' || r == '\u000C' || r == '\u0020' || r == '\u00A0' || r == '\u1680' || (r >= '\u2000' && r <= '\u200A') || r == '\u202F' || r == '\u205F' || r == '\u3000' || r == '\n' || r == '\r' || r == '\u2028' || r == '\u2029'
	})
}
