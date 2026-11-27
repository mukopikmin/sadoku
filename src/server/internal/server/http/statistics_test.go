package http_test

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"
	pb "github.com/mukopikmin/sadoku/internal/gen/sadoku/preview/v1"
	"github.com/mukopikmin/sadoku/internal/gen/sadoku/preview/v1/previewv1connect"
	"github.com/mukopikmin/sadoku/internal/server/db"
	httpadapter "github.com/mukopikmin/sadoku/internal/server/http"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
	"google.golang.org/protobuf/encoding/protojson"
)

func TestStatisticsIncludesRecordsOutsideThePreview(t *testing.T) {
	s, _, _ := setup(t)
	handler, err := httpadapter.New(s, httpadapter.Options{})
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	ctx := t.Context()
	repo := s.Repository
	doc, err := repo.Ensure(ctx, "outside-preview.md")
	if err != nil {
		t.Fatal(err)
	}
	stamp := db.Now()
	human, bot := u.Author{Type: "human"}, u.Author{Type: "bot"}
	hash, source := "hash", "# Heading"
	if err := repo.SaveComments(ctx, doc.ID, u.Comments{Comments: []u.Comment{
		{
			ID: 1, Author: human, Body: "Resolved", CreatedAt: stamp, UpdatedAt: stamp,
			SourceHash: &hash, SourceText: &source, Resolved: true, ResolvedAt: &stamp, ResolvedBy: &human,
		},
		{
			ID: 2, Author: bot, Body: "Stale", CreatedAt: stamp, UpdatedAt: stamp,
			SourceHash: &hash, SourceText: &source, Stale: true,
			Replies: []u.Reply{
				{ID: 1, Author: human, Body: "Human reply", CreatedAt: stamp, UpdatedAt: stamp},
				{ID: 2, Author: human, Body: "Second reply", CreatedAt: stamp, UpdatedAt: stamp},
				{ID: 3, Author: bot, Body: "Bot reply", CreatedAt: stamp, UpdatedAt: stamp},
			},
		},
	}}); err != nil {
		t.Fatal(err)
	}
	if err := repo.RecordRevision(ctx, doc.ID, "# Saved"); err != nil {
		t.Fatal(err)
	}
	var tags []int64
	for _, name := range []string{"Review", "Diagnostics"} {
		tag, err := repo.SaveTag(ctx, u.Tag{Name: name, BackgroundColor: "#123456"})
		if err != nil {
			t.Fatal(err)
		}
		tags = append(tags, tag.ID)
	}
	if err := repo.ReplaceTags(ctx, doc.ID, tags); err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"memory", "instruction"} {
		if _, err := repo.SaveNote(ctx, kind, u.Note{DocumentID: doc.ID, Content: kind}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := repo.SaveGlobalInstruction(ctx, u.Note{Content: "Global instructions"}); err != nil {
		t.Fatal(err)
	}

	client := previewv1connect.NewPreviewServiceClient(server.Client(), server.URL, connect.WithProtoJSON())
	response, err := client.GetStatistics(ctx, connect.NewRequest(&pb.GetStatisticsRequest{IncludeDetails: true}))
	if err != nil {
		t.Fatal(err)
	}
	stats := response.Msg
	if stats.GetDocumentCount() != 2 || stats.GetCommentCount().GetHuman() != 1 ||
		stats.GetCommentCount().GetBot() != 1 || stats.GetDatabaseSize() == 0 {
		t.Fatalf("basic statistics = %v", stats)
	}
	details := stats.GetDetails()
	if details.GetReplyCount().GetHuman() != 2 || details.GetReplyCount().GetBot() != 1 ||
		details.GetResolvedThreadCount() != 1 || details.GetStaleThreadCount() != 1 {
		t.Fatalf("review statistics = %v", details)
	}
	if details.GetRevisionCount() != 2 || details.GetDocumentsWithRevisionsCount() != 2 ||
		details.GetTaggedDocumentCount() != 1 || details.GetTagCount() != 2 ||
		details.GetMemoryCount() != 1 || details.GetDocumentInstructionCount() != 1 ||
		details.GetGlobalInstructionCount() != 1 {
		t.Fatalf("saved data statistics = %v", details)
	}
	if path := filepath.FromSlash(details.GetDatabasePath()); !filepath.IsAbs(path) || filepath.Base(path) != "sadoku.sqlite3" {
		t.Fatalf("database path = %q", path)
	}
	if details.GetSqliteVersion() == "" || details.GetLastMigrationVersion() == "" {
		t.Fatalf("database metadata = %v", details)
	}
	for _, value := range []string{details.GetLastRevisionAt(), details.GetLastMigrationAt()} {
		if _, err := time.Parse(time.RFC3339, value); err != nil {
			t.Fatalf("invalid statistics timestamp %q: %v", value, err)
		}
	}
}

func TestStatisticsOmitsDatabasePathFromSharedPreviews(t *testing.T) {
	s, _, _ := setup(t)
	for _, tc := range []struct {
		name, peer      string
		forwardedPrefix bool
	}{
		{name: "remote", peer: "192.0.2.20:5000"},
		{name: "trusted proxy", peer: "127.0.0.1:5000", forwardedPrefix: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			handler, err := httpadapter.New(s, httpadapter.Options{TrustForwardedPrefix: tc.forwardedPrefix})
			if err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, previewv1connect.PreviewServiceGetStatisticsProcedure, strings.NewReader(`{"includeDetails":true}`))
			req.RemoteAddr = tc.peer
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Connect-Protocol-Version", "1")
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)
			if recorder.Code != http.StatusOK {
				t.Fatalf("statistics returned %d: %s", recorder.Code, recorder.Body)
			}
			var stats pb.GetStatisticsResponse
			if err := protojson.Unmarshal(recorder.Body.Bytes(), &stats); err != nil {
				t.Fatal(err)
			}
			if stats.GetDetails().GetDatabasePath() != "" || stats.GetDetails().GetSqliteVersion() == "" || stats.GetDatabaseSize() == 0 {
				t.Fatalf("shared preview statistics = %v", &stats)
			}
		})
	}
}
