package storage

import (
	"testing"

	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func TestTagPatchesPreserveOtherFields(t *testing.T) {
	r := testRepository(t)
	ctx := t.Context()
	tag, err := r.SaveTag(ctx, u.Tag{Name: "Review", BackgroundColor: "#123456"})
	if err != nil {
		t.Fatal(err)
	}
	name, color := "Done", "#abcdef"
	if _, err := r.UpdateTag(ctx, tag.ID, u.TagPatch{Name: &name}); err != nil {
		t.Fatal(err)
	}
	updated, err := r.UpdateTag(ctx, tag.ID, u.TagPatch{BackgroundColor: &color})
	if err != nil || updated.Name != name || updated.BackgroundColor != color {
		t.Fatalf("independent patches did not compose: %+v, %v", updated, err)
	}
}
