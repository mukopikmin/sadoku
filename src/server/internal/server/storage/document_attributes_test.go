package storage

import (
	"context"
	"errors"
	"testing"
)

func TestDocumentAttributesHonorCanceledContext(t *testing.T) {
	r := testRepository(t)
	doc, err := r.RegisterDocument(t.Context(), "original.md", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := r.RegisterDocument(ctx, "canceled.md", nil, nil); !errors.Is(err, context.Canceled) {
		t.Fatalf("registration error = %v", err)
	}
	title := "changed"
	titleValue := &title
	if _, err := r.UpdateDocumentAttributes(ctx, doc.ID, &titleValue, nil); !errors.Is(err, context.Canceled) {
		t.Fatalf("update error = %v", err)
	}
	documents, err := r.Documents(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(documents) != 1 || documents[0].ID != doc.ID || documents[0].DisplayTitle != nil {
		t.Fatalf("canceled operations changed documents: %#v", documents)
	}
}
