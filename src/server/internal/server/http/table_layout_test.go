package http_test

import (
	"context"
	"os"
	"reflect"
	"testing"

	"connectrpc.com/connect"
	pb "github.com/mukopikmin/sadoku/internal/gen/sadoku/preview/v1"
	"github.com/mukopikmin/sadoku/internal/gen/sadoku/preview/v1/previewv1connect"
)

func TestTableLayoutWorkflowAcrossClientsAndEdits(t *testing.T) {
	for _, jsonCodec := range []bool{false, true} {
		t.Run(map[bool]string{false: "Protobuf", true: "JSON"}[jsonCodec], func(t *testing.T) {
			_, server, file := setup(t)
			options := []connect.ClientOption{}
			if jsonCodec {
				options = append(options, connect.WithProtoJSON())
			}
			client := previewv1connect.NewPreviewServiceClient(server.Client(), server.URL, options...)
			ctx := context.Background()
			list, err := client.ListDocuments(ctx, connect.NewRequest(&pb.ListDocumentsRequest{}))
			if err != nil {
				t.Fatal(err)
			}
			id := list.Msg.Documents[0].Id
			markdown := "| A | B | C |\n| - | - | - |\n| 1 | 2 | 3 |"
			if err := os.WriteFile(file, []byte(markdown), 0600); err != nil {
				t.Fatal(err)
			}
			get := &pb.GetTableLayoutsRequest{DocumentId: id, DisplayedMarkdown: markdown, Tables: []*pb.TablePosition{{StartLine: 1, EndLine: 3, ColumnCount: 3}}}
			layouts, err := client.GetTableLayouts(ctx, connect.NewRequest(get))
			if err != nil || len(layouts.Msg.Tables) != 1 {
				t.Fatalf("load: %v %v", layouts, err)
			}
			if layouts.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("missing cache policy")
			}
			tableID := layouts.Msg.Tables[0].Id
			update := &pb.UpdateTableLayoutRequest{DocumentId: id, DisplayedMarkdown: markdown, TableId: tableID, ColumnWidths: []float64{100, 200, 300}}
			if _, err := client.UpdateTableLayout(ctx, connect.NewRequest(update)); err != nil {
				t.Fatal(err)
			}
			// An independent client has no browser storage or cookies to reuse.
			other := previewv1connect.NewPreviewServiceClient(server.Client(), server.URL, options...)
			layouts, err = other.GetTableLayouts(ctx, connect.NewRequest(get))
			if err != nil || !reflect.DeepEqual(layouts.Msg.Tables[0].ColumnWidths, update.ColumnWidths) {
				t.Fatalf("cross-client restore: %v %v", layouts, err)
			}
			edited := "New text\n\n| A edited | C |\n| - | - |\n| new | 3 |"
			if err := os.WriteFile(file, []byte(edited), 0600); err != nil {
				t.Fatal(err)
			}
			if _, err := client.UpdateTableLayout(ctx, connect.NewRequest(update)); connect.CodeOf(err) != connect.CodeAborted {
				t.Fatalf("stale browser update: %v", err)
			}
			get.DisplayedMarkdown, get.Tables[0].StartLine, get.Tables[0].EndLine, get.Tables[0].ColumnCount = edited, 3, 5, 2
			layouts, err = other.GetTableLayouts(ctx, connect.NewRequest(get))
			if err != nil || layouts.Msg.Tables[0].Id != tableID || !reflect.DeepEqual(layouts.Msg.Tables[0].ColumnWidths, []float64{100, 200}) {
				t.Fatalf("edited table restore: %v %v", layouts, err)
			}
			update.DisplayedMarkdown = edited
			if _, err := client.UpdateTableLayout(ctx, connect.NewRequest(update)); connect.CodeOf(err) != connect.CodeInvalidArgument {
				t.Fatalf("excess widths: %v", err)
			}
			update.ColumnWidths = []float64{20}
			if _, err := client.UpdateTableLayout(ctx, connect.NewRequest(update)); connect.CodeOf(err) != connect.CodeInvalidArgument {
				t.Fatalf("invalid width: %v", err)
			}
			update.ColumnWidths = nil
			if _, err := client.UpdateTableLayout(ctx, connect.NewRequest(update)); err != nil {
				t.Fatal(err)
			}
			layouts, err = other.GetTableLayouts(ctx, connect.NewRequest(get))
			if err != nil || len(layouts.Msg.Tables[0].ColumnWidths) != 0 {
				t.Fatalf("reset: %v %v", layouts, err)
			}
		})
	}
}
