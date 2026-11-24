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
	type appearance struct {
		highlightBoundaries, wideLayout, wideTables bool
	}
	for _, transport := range []string{"REST", "JSON", "Protobuf"} {
		t.Run(transport, func(t *testing.T) {
			_, server, _ := setup(t)
			options := []connect.ClientOption{}
			if transport == "JSON" {
				options = append(options, connect.WithProtoJSON())
			}
			client := previewv1connect.NewPreviewServiceClient(server.Client(), server.URL, options...)
			ctx := context.Background()
			check := func(want appearance) {
				t.Helper()
				stored, _, err := config.Read()
				if got := (appearance{stored.ShowHighlightBoundaries, stored.WideLayout, stored.WideTables}); err != nil || got != want {
					t.Fatalf("stored appearance settings: got %+v, want %+v, error %v", got, want, err)
				}
				if transport == "REST" {
					body := restRequest(ctx, t, server.URL, "GET", "/__sadoku/settings", "", "", 200)
					var settings config.Settings
					err := json.Unmarshal(body, &settings)
					if got := (appearance{settings.ShowHighlightBoundaries, settings.WideLayout, settings.WideTables}); err != nil || got != want {
						t.Fatalf("REST settings: got %+v, want %+v, error %v", got, want, err)
					}
				} else {
					settings, err := client.GetSettings(ctx, connect.NewRequest(&pb.GetSettingsRequest{}))
					if err != nil {
						t.Fatal(err)
					}
					if got := (appearance{settings.Msg.GetShowHighlightBoundaries(), settings.Msg.GetWideLayout(), settings.Msg.GetWideTables()}); got != want {
						t.Fatalf("RPC settings: got %+v, want %+v", got, want)
					}
				}
			}
			check(appearance{})
			for _, options := range []appearance{
				{highlightBoundaries: true},
				{wideLayout: true},
				{wideTables: true},
				{},
				{highlightBoundaries: true, wideLayout: true, wideTables: true},
			} {
				if transport == "REST" {
					body := fmt.Sprintf(`{"theme":"light","codeWrap":"scroll","fontScale":1,"maxDepth":2,"maxFiles":20,"excludedDirectories":[],"markdownExtensions":[".md"],"showHighlightBoundaries":%t,"wideLayout":%t,"wideTables":%t}`, options.highlightBoundaries, options.wideLayout, options.wideTables)
					restRequest(ctx, t, server.URL, "PUT", "/__sadoku/settings", body, "application/json", 200)
				} else {
					_, err := client.UpdateSettings(ctx, connect.NewRequest(&pb.UpdateSettingsRequest{
						Theme: "light", CodeWrap: "scroll", FontScale: 1, MaxDepth: 2, MaxFiles: 20,
						MarkdownExtensions:      []string{".md"},
						ShowHighlightBoundaries: &options.highlightBoundaries,
						WideLayout:              &options.wideLayout,
						WideTables:              &options.wideTables,
					}))
					if err != nil {
						t.Fatal(err)
					}
				}
				check(options)
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
			check(appearance{highlightBoundaries: true, wideLayout: true, wideTables: true})
		})
	}
}
