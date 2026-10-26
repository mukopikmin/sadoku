package session

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestMarkdownFetchTransportFailureAndCancellation(t *testing.T) {
	remote := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	remote.Close()
	if _, err := ReadMarkdown(context.Background(), remote.URL); err == nil || err.Error() != "fetch failed" {
		t.Fatalf("transport error: %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := ReadMarkdown(ctx, remote.URL); err != context.Canceled {
		t.Fatalf("canceled read: %v", err)
	}
}

func TestLegacyMarkdownReadTranscripts(t *testing.T) {
	var fixture struct {
		Reference string
		Decoding  []struct {
			Bytes         []int
			Local, Remote string
		}
		Statuses []struct {
			Status      int
			Text, Error string
		}
	}
	b, err := os.ReadFile("testdata/legacy_reads.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(b, &fixture); err != nil {
		t.Fatal(err)
	}
	if fixture.Reference != "368b47eb1ae18a84d428ce4367d25cb815584968" {
		t.Fatal("unknown read reference")
	}
	for i, test := range fixture.Decoding {
		t.Run(fmt.Sprintf("decoding/%d", i), func(t *testing.T) {
			data := make([]byte, len(test.Bytes))
			for i, b := range test.Bytes {
				data[i] = byte(b)
			}
			path := filepath.Join(t.TempDir(), "readme.md")
			if err := os.WriteFile(path, data, 0600); err != nil {
				t.Fatal(err)
			}
			text, err := ReadMarkdown(context.Background(), path)
			if err != nil || text != test.Local {
				t.Errorf("local: %q %v; want %q", text, err, test.Local)
			}
			remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write(data) }))
			defer remote.Close()
			text, err = ReadMarkdown(context.Background(), remote.URL+"/readme.md")
			if err != nil || text != test.Remote {
				t.Errorf("remote: %q %v; want %q", text, err, test.Remote)
			}
		})
	}
	for _, test := range fixture.Statuses {
		t.Run(fmt.Sprintf("status/%d", test.Status), func(t *testing.T) {
			remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(test.Status)
				fmt.Fprint(w, "# Title\nBody\n")
			}))
			defer remote.Close()
			text, err := ReadMarkdown(context.Background(), remote.URL+"/readme.md")
			if test.Error != "" {
				if err == nil || err.Error() != test.Error {
					t.Fatalf("fetch error: %v; want %q", err, test.Error)
				}
			} else if err != nil || text != test.Text {
				t.Fatalf("fetch: %q %v; want %q", text, err, test.Text)
			}
		})
	}
}
