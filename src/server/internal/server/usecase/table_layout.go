package usecase

import (
	"crypto/rand"
	"math"
	"strings"
)

// Column widths belong to positions. Zero means the browser chooses the width.
type TablePosition struct {
	StartLine   int `json:"startLine"`
	EndLine     int `json:"endLine"`
	ColumnCount int `json:"columnCount"`
}

type TableLayout struct {
	TablePosition
	ID           string    `json:"id"`
	ColumnWidths []float64 `json:"columnWidths"`
}

type TableLayoutState struct {
	Markdown string        `json:"markdown"`
	Tables   []TableLayout `json:"tables"`
}

func ResolveTableLayouts(before TableLayoutState, markdown string, positions []TablePosition) (TableLayoutState, error) {
	lineCount := strings.Count(markdown, "\n") + 1
	if len(positions) > 1000 {
		return TableLayoutState{}, Fail("invalid_argument", "Too many tables.")
	}
	lastEnd := 0
	for _, p := range positions {
		if p.StartLine <= lastEnd || p.EndLine <= p.StartLine || p.EndLine > lineCount || p.ColumnCount < 1 || p.ColumnCount > 1000 {
			return TableLayoutState{}, Fail("invalid_argument", "Invalid table position or column count.")
		}
		lastEnd = p.EndLine
	}
	result := TableLayoutState{Markdown: markdown, Tables: make([]TableLayout, len(positions))}
	used := make(map[int]bool)
	assigned := make(map[int]bool)
	assign := func(old, next int) {
		layout := before.Tables[old]
		layout.TablePosition = positions[next]
		layout.ColumnWidths = append([]float64{}, layout.ColumnWidths[:min(len(layout.ColumnWidths), positions[next].ColumnCount)]...)
		result.Tables[next] = layout
		used[old], assigned[next] = true, true
	}
	oldLines, newLines := strings.Split(before.Markdown, "\n"), strings.Split(markdown, "\n")
	texts := func(lines []string, tables []TablePosition) map[string][]int {
		result := make(map[string][]int)
		for i, table := range tables {
			if table.StartLine >= 1 && table.EndLine >= table.StartLine && table.EndLine <= len(lines) {
				text := strings.Join(lines[table.StartLine-1:table.EndLine], "\n")
				result[text] = append(result[text], i)
			}
		}
		return result
	}
	oldPositions := make([]TablePosition, len(before.Tables))
	for i, table := range before.Tables {
		oldPositions[i] = table.TablePosition
	}
	oldTexts, newTexts := texts(oldLines, oldPositions), texts(newLines, positions)
	// Unique unchanged tables keep their identity even when moved.
	for text, old := range oldTexts {
		if next := newTexts[text]; len(old) == 1 && len(next) == 1 {
			assign(old[0], next[0])
		}
	}
	var mapping map[int]lineRange
	if len(before.Tables) > 0 {
		mapping = mapTableLines(oldLines, newLines)
	}
	candidates := make(map[int][]int)
	counts := make(map[int]int)
	for i, old := range before.Tables {
		if used[i] {
			continue
		}
		for j, next := range positions {
			if assigned[j] {
				continue
			}
			for line := old.StartLine; line <= old.EndLine; line++ {
				if mapped, ok := mapping[line]; ok && mapped.start <= next.EndLine && mapped.end >= next.StartLine {
					candidates[i] = append(candidates[i], j)
					counts[j]++
					break
				}
			}
		}
	}
	for old, matches := range candidates {
		if len(matches) == 1 && counts[matches[0]] == 1 {
			assign(old, matches[0])
		}
	}
	for i, p := range positions {
		if !assigned[i] {
			result.Tables[i] = TableLayout{TablePosition: p, ID: rand.Text(), ColumnWidths: []float64{}}
		}
	}
	return result, nil
}

func ValidateColumnWidths(widths []float64, columnCount int) error {
	if len(widths) > columnCount {
		return Fail("invalid_argument", "Too many column widths.")
	}
	for _, width := range widths {
		if math.IsNaN(width) || math.IsInf(width, 0) || (width != 0 && (width < 64 || width > 2000)) {
			return Fail("invalid_argument", "Column widths must be zero (automatic), or between 64 and 2000 pixels.")
		}
	}
	return nil
}

// Trim unchanged edges before computing a bounded diff. Ordinary edits in long
// documents still follow tables without allocating an LCS for the whole file.
func mapTableLines(before, after []string) map[int]lineRange {
	result := make(map[int]lineRange)
	start, oldEnd, newEnd := 0, len(before), len(after)
	for start < oldEnd && start < newEnd && before[start] == after[start] {
		result[start+1] = lineRange{start + 1, start + 1}
		start++
	}
	for oldEnd > start && newEnd > start && before[oldEnd-1] == after[newEnd-1] {
		result[oldEnd] = lineRange{newEnd, newEnd}
		oldEnd--
		newEnd--
	}
	if oldEnd == start || newEnd == start || int64(oldEnd-start+1)*int64(newEnd-start+1) > 4_000_000 {
		return result
	}
	for line, mapped := range mapLines(strings.Join(before[start:oldEnd], "\n"), strings.Join(after[start:newEnd], "\n")) {
		result[line+start] = lineRange{mapped.start + start, mapped.end + start}
	}
	return result
}
