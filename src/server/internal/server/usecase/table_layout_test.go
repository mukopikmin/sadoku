package usecase

import (
	"math"
	"reflect"
	"strings"
	"testing"
)

func TestTableLayoutsFollowEditsAndDropOnlyTrailingWidths(t *testing.T) {
	before := "# Heading\n\n| A | B | C |\n| - | - | - |\n| 1 | 2 | 3 |\n"
	state, err := ResolveTableLayouts(TableLayoutState{}, before, []TablePosition{{3, 5, 3}})
	if err != nil {
		t.Fatal(err)
	}
	id := state.Tables[0].ID
	state.Tables[0].ColumnWidths = []float64{100, 200, 300}
	// Delete the middle column, rename a header, edit the contents, and add prose.
	after := "# Heading\n\nNew paragraph\n\n| Renamed | C |\n| - | - |\n| edited | 3 |\n"
	state, err = ResolveTableLayouts(state, after, []TablePosition{{5, 7, 2}})
	if err != nil || state.Tables[0].ID != id || !reflect.DeepEqual(state.Tables[0].ColumnWidths, []float64{100, 200}) {
		t.Fatalf("edited table: %+v, %v", state, err)
	}
	state, err = ResolveTableLayouts(state, before, []TablePosition{{3, 5, 3}})
	if err != nil || state.Tables[0].ID != id || !reflect.DeepEqual(state.Tables[0].ColumnWidths, []float64{100, 200}) {
		t.Fatalf("added column resurrected discarded width: %+v, %v", state, err)
	}
}

func TestTableLayoutsFollowMovedTablesAndRejectAmbiguousMatches(t *testing.T) {
	a := "| A |\n| - |\n| 1 |"
	b := "| B |\n| - |\n| 2 |"
	state, err := ResolveTableLayouts(TableLayoutState{}, a+"\n\n"+b, []TablePosition{{1, 3, 1}, {5, 7, 1}})
	if err != nil {
		t.Fatal(err)
	}
	state.Tables[0].ColumnWidths = []float64{150}
	state.Tables[1].ColumnWidths = []float64{250}
	moved, err := ResolveTableLayouts(state, b+"\n\n"+a, []TablePosition{{1, 3, 1}, {5, 7, 1}})
	if err != nil || moved.Tables[0].ID != state.Tables[1].ID || moved.Tables[1].ID != state.Tables[0].ID {
		t.Fatalf("moved: %+v, %v", moved, err)
	}
	// A single old replacement region maps to two new tables, so neither inherits.
	ambiguous, err := ResolveTableLayouts(TableLayoutState{Markdown: "old\ntable", Tables: []TableLayout{{TablePosition: TablePosition{1, 2, 1}, ID: "old", ColumnWidths: []float64{150}}}}, a+"\n\n"+b, []TablePosition{{1, 3, 1}, {5, 7, 1}})
	if err != nil {
		t.Fatal(err)
	}
	for _, table := range ambiguous.Tables {
		if table.ID == "old" || len(table.ColumnWidths) != 0 {
			t.Fatalf("ambiguous table inherited widths: %+v", table)
		}
	}
}

func TestTableLayoutValidation(t *testing.T) {
	for _, widths := range [][]float64{{-1}, {63}, {2001}, {math.NaN()}, {math.Inf(1)}, {100, 200}} {
		if ValidateColumnWidths(widths, 1) == nil {
			t.Fatalf("accepted widths %v", widths)
		}
	}
	for _, widths := range [][]float64{nil, {}, {0, 64, 2000}} {
		if err := ValidateColumnWidths(widths, 3); err != nil {
			t.Fatal(err)
		}
	}
	for _, positions := range [][]TablePosition{{{0, 2, 1}}, {{1, 1, 1}}, {{1, 4, 1}}, {{1, 2, 0}}, {{1, 2, 1001}}, {{1, 2, 1}, {2, 3, 1}}} {
		if _, err := ResolveTableLayouts(TableLayoutState{}, "a\nb\nc", positions); err == nil {
			t.Fatalf("accepted positions %v", positions)
		}
	}
}

func TestTableLayoutsFollowSmallEditsInLongDocuments(t *testing.T) {
	before := strings.Repeat("unchanged\n", 3000) + "| A |\n| - |\n| 1 |"
	state, err := ResolveTableLayouts(TableLayoutState{}, before, []TablePosition{{3001, 3003, 1}})
	if err != nil {
		t.Fatal(err)
	}
	state.Tables[0].ColumnWidths = []float64{200}
	after := strings.Repeat("unchanged\n", 3000) + "New paragraph\n\n| A renamed |\n| - |\n| edited |"
	next, err := ResolveTableLayouts(state, after, []TablePosition{{3003, 3005, 1}})
	if err != nil || next.Tables[0].ID != state.Tables[0].ID || !reflect.DeepEqual(next.Tables[0].ColumnWidths, []float64{200}) {
		t.Fatalf("long document: %+v %v", next.Tables, err)
	}
}
