package http_test

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"connectrpc.com/connect"
	pb "github.com/mukopikmin/sadoku/internal/gen/sadoku/preview/v1"
	"github.com/mukopikmin/sadoku/internal/gen/sadoku/preview/v1/previewv1connect"
	"github.com/mukopikmin/sadoku/internal/server/config"
)

func TestOptionalAppearanceSettingsRoundTrip(t *testing.T) {
	for _, transport := range []string{"REST", "JSON", "Protobuf"} {
		t.Run(transport, func(t *testing.T) {
			_, server, _ := setup(t)
			options := []connect.ClientOption{}
			if transport == "JSON" {
				options = append(options, connect.WithProtoJSON())
			}
			client := previewv1connect.NewPreviewServiceClient(server.Client(), server.URL, options...)
			ctx := context.Background()
			check := func(highlightBoundaries, wideLayout bool) {
				t.Helper()
				stored, _, err := config.Read()
				if err != nil || stored.ShowHighlightBoundaries != highlightBoundaries || stored.WideLayout != wideLayout {
					t.Fatalf("stored appearance settings: %+v %v", stored, err)
				}
				if transport == "REST" {
					body := restRequest(ctx, t, server.URL, "GET", "/__sadoku/settings", "", "", 200)
					var settings config.Settings
					if err := json.Unmarshal(body, &settings); err != nil || settings.ShowHighlightBoundaries != highlightBoundaries || settings.WideLayout != wideLayout {
						t.Fatalf("REST settings: %s %v", body, err)
					}
				} else {
					settings, err := client.GetSettings(ctx, connect.NewRequest(&pb.GetSettingsRequest{}))
					if err != nil || settings.Msg.GetShowHighlightBoundaries() != highlightBoundaries || settings.Msg.GetWideLayout() != wideLayout {
						t.Fatalf("RPC settings: %v %v", settings, err)
					}
				}
			}
			check(false, false)
			for _, options := range []struct{ highlightBoundaries, wideLayout bool }{
				{true, false}, {false, true}, {true, true}, {false, false}, {true, true},
			} {
				if transport == "REST" {
					body := fmt.Sprintf(`{"theme":"light","codeWrap":"scroll","fontScale":1,"maxDepth":2,"maxFiles":20,"excludedDirectories":[],"markdownExtensions":[".md"],"showHighlightBoundaries":%t,"wideLayout":%t}`, options.highlightBoundaries, options.wideLayout)
					restRequest(ctx, t, server.URL, "PUT", "/__sadoku/settings", body, "application/json", 200)
				} else {
					_, err := client.UpdateSettings(ctx, connect.NewRequest(&pb.UpdateSettingsRequest{
						Theme: "light", CodeWrap: "scroll", FontScale: 1, MaxDepth: 2, MaxFiles: 20,
						MarkdownExtensions:      []string{".md"},
						ShowHighlightBoundaries: &options.highlightBoundaries, WideLayout: &options.wideLayout,
					}))
					if err != nil {
						t.Fatal(err)
					}
				}
				check(options.highlightBoundaries, options.wideLayout)
			}
			// Older clients omit these settings and must preserve the saved values.
			if transport == "REST" {
				restRequest(ctx, t, server.URL, "PUT", "/__sadoku/settings", `{"theme":"dark","codeWrap":"wrap","fontScale":1,"maxDepth":2,"maxFiles":20}`, "application/json", 200)
			} else {
				_, err := client.UpdateSettings(ctx, connect.NewRequest(&pb.UpdateSettingsRequest{
					Theme: "dark", CodeWrap: "wrap", FontScale: 1, MaxDepth: 2, MaxFiles: 20, MarkdownExtensions: []string{".md"},
				}))
				if err != nil {
					t.Fatal(err)
				}
			}
			check(true, true)
		})
	}
}
