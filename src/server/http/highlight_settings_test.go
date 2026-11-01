package http_test

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"connectrpc.com/connect"
	pb "github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1"
	"github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1/previewv1connect"
	"github.com/mukopikmin/sadoku/src/server/config"
)

func TestHighlightBoundarySettingsRoundTrip(t *testing.T) {
	for _, transport := range []string{"REST", "JSON", "Protobuf"} {
		t.Run(transport, func(t *testing.T) {
			_, server, _ := setup(t)
			options := []connect.ClientOption{}
			if transport == "JSON" {
				options = append(options, connect.WithProtoJSON())
			}
			client := previewv1connect.NewPreviewServiceClient(server.Client(), server.URL, options...)
			ctx := context.Background()
			check := func(want bool) {
				t.Helper()
				stored, _, err := config.Read()
				if err != nil || stored.ShowHighlightBoundaries != want {
					t.Fatalf("stored highlight boundaries: %+v %v", stored, err)
				}
				if transport == "REST" {
					body := restRequest(t, server.URL, "GET", "/__sadoku/settings", "", "", 200)
					var settings config.Settings
					if err := json.Unmarshal(body, &settings); err != nil || settings.ShowHighlightBoundaries != want {
						t.Fatalf("REST settings: %s %v", body, err)
					}
				} else {
					settings, err := client.GetSettings(ctx, connect.NewRequest(&pb.GetSettingsRequest{}))
					if err != nil || settings.Msg.GetShowHighlightBoundaries() != want {
						t.Fatalf("RPC settings: %v %v", settings, err)
					}
				}
			}
			check(false)
			for _, enabled := range []bool{true, false, true} {
				if transport == "REST" {
					body := fmt.Sprintf(`{"theme":"light","codeWrap":"scroll","fontScale":1,"maxDepth":2,"maxFiles":20,"excludedDirectories":[],"markdownExtensions":[".md"],"showHighlightBoundaries":%t}`, enabled)
					restRequest(t, server.URL, "PUT", "/__sadoku/settings", body, "application/json", 200)
				} else {
					_, err := client.UpdateSettings(ctx, connect.NewRequest(&pb.UpdateSettingsRequest{
						Theme: "light", CodeWrap: "scroll", FontScale: 1, MaxDepth: 2, MaxFiles: 20,
						MarkdownExtensions: []string{".md"}, ShowHighlightBoundaries: &enabled,
					}))
					if err != nil {
						t.Fatal(err)
					}
				}
				check(enabled)
			}
			// Older clients omit this setting and must preserve the saved value.
			if transport == "REST" {
				restRequest(t, server.URL, "PUT", "/__sadoku/settings", `{"theme":"dark","codeWrap":"wrap","fontScale":1,"maxDepth":2,"maxFiles":20}`, "application/json", 200)
			} else {
				_, err := client.UpdateSettings(ctx, connect.NewRequest(&pb.UpdateSettingsRequest{
					Theme: "dark", CodeWrap: "wrap", FontScale: 1, MaxDepth: 2, MaxFiles: 20, MarkdownExtensions: []string{".md"},
				}))
				if err != nil {
					t.Fatal(err)
				}
			}
			check(true)
		})
	}
}
