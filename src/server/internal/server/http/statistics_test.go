package http_test

import (
	"testing"

	"connectrpc.com/connect"
	pb "github.com/mukopikmin/sadoku/internal/gen/sadoku/preview/v1"
	"github.com/mukopikmin/sadoku/internal/gen/sadoku/preview/v1/previewv1connect"
	"github.com/mukopikmin/sadoku/internal/server/db"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func TestStatisticsCountsDistinctReviewedDocumentsAcrossTheDatabase(t *testing.T) {
	s, server, _ := setup(t)
	ctx := t.Context()
	repo := s.Repository
	mixed, err := repo.Ensure(ctx, "outside-preview.md")
	if err != nil {
		t.Fatal(err)
	}
	resolvedOnly, err := repo.Ensure(ctx, "resolved.md")
	if err != nil {
		t.Fatal(err)
	}
	stamp := db.Now()
	human, bot := u.Author{Type: "human"}, u.Author{Type: "bot"}
	hash, source := "hash", "# Heading"
	resolved := u.Comment{
		ID: 1, Author: human, Body: "Resolved", CreatedAt: stamp, UpdatedAt: stamp,
		SourceHash: &hash, SourceText: &source, Resolved: true, ResolvedAt: &stamp, ResolvedBy: &human,
	}
	if err := repo.SaveComments(ctx, mixed.ID, u.Comments{Comments: []u.Comment{
		resolved,
		{
			ID: 2, Author: bot, Body: "Unresolved", CreatedAt: stamp, UpdatedAt: stamp,
			SourceHash: &hash, SourceText: &source,
			Replies: []u.Reply{
				{ID: 1, Author: human, Body: "Human reply", CreatedAt: stamp, UpdatedAt: stamp},
				{ID: 2, Author: human, Body: "Second human reply", CreatedAt: stamp, UpdatedAt: stamp},
				{ID: 3, Author: bot, Body: "Bot reply", CreatedAt: stamp, UpdatedAt: stamp},
			},
		},
		{
			ID: 3, Author: bot, Body: "Also unresolved", CreatedAt: stamp, UpdatedAt: stamp,
			SourceHash: &hash, SourceText: &source, Stale: true,
		},
	}}); err != nil {
		t.Fatal(err)
	}
	if err := repo.SaveComments(ctx, resolvedOnly.ID, u.Comments{Comments: []u.Comment{resolved}}); err != nil {
		t.Fatal(err)
	}
	if err := repo.RecordRevision(ctx, mixed.ID, "# Saved"); err != nil {
		t.Fatal(err)
	}

	client := previewv1connect.NewPreviewServiceClient(server.Client(), server.URL, connect.WithProtoJSON())
	response, err := client.GetStatistics(ctx, connect.NewRequest(&pb.GetStatisticsRequest{IncludeDetails: true}))
	if err != nil {
		t.Fatal(err)
	}
	stats := response.Msg
	if stats.GetDocumentCount() != 3 || stats.GetCommentCount().GetHuman() != 2 ||
		stats.GetCommentCount().GetBot() != 2 || stats.GetDatabaseSize() == 0 {
		t.Fatalf("basic statistics = %v", stats)
	}
	details := stats.GetDetails()
	if details.GetDocumentsWithCommentsCount() != 2 || details.GetDocumentsWithUnresolvedThreadsCount() != 1 ||
		details.GetResolvedThreadCount() != 2 || details.GetRevisionCount() != 2 ||
		details.GetReplyCount().GetHuman() != 2 || details.GetReplyCount().GetBot() != 1 {
		t.Fatalf("review and revision statistics = %v", details)
	}
}
