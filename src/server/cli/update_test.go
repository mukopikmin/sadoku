package cli

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
)

func TestUpdateArchiveValidation(t *testing.T) {
	var buffer bytes.Buffer
	gz := gzip.NewWriter(&buffer)
	tr := tar.NewWriter(gz)
	contents := []byte("binary")
	if err := tr.WriteHeader(&tar.Header{Name: "release/sadoku", Mode: 0755, Size: int64(len(contents)), Typeflag: tar.TypeReg}); err != nil {
		t.Fatal(err)
	}
	if _, err := tr.Write(contents); err != nil {
		t.Fatal(err)
	}
	tr.Close()
	gz.Close()
	checksum := fmt.Sprintf("%x", sha256.Sum256(buffer.Bytes()))
	if err := verifyArchive(buffer.Bytes(), []byte(checksum+"\n")); err != nil {
		t.Fatal(err)
	}
	if err := verifyArchive([]byte("changed"), []byte(checksum)); err == nil {
		t.Fatal("accepted corrupted archive")
	}
	b, err := archiveBinary(buffer.Bytes(), "release", "sadoku", false)
	if err != nil || string(b) != "binary" {
		t.Fatal(string(b), err)
	}
	if _, err = archiveBinary(buffer.Bytes(), "other", "sadoku", false); err == nil {
		t.Fatal("accepted missing binary")
	}
	buffer.Reset()
	zw := zip.NewWriter(&buffer)
	file, err := zw.Create("release/sadoku.exe")
	if err != nil {
		t.Fatal(err)
	}
	file.Write(contents)
	zw.Close()
	b, err = archiveBinary(buffer.Bytes(), "release", "sadoku.exe", true)
	if err != nil || string(b) != "binary" {
		t.Fatal(string(b), err)
	}
}
func TestUpdateNeverDowngrades(t *testing.T) {
	for _, test := range []struct {
		channel, current, target string
		newer                    bool
	}{{"stable", "2.0.0", "1.9.9", false}, {"stable", "1.2.3", "1.2.3", false}, {"stable", "1.2.3-rc1", "1.2.3", true}, {"stable", "1.2.3", "1.2.4", true}, {"nightly", "nightly-20261025-1234abcd", "nightly-20261024-1234abcd", false}, {"nightly", "nightly-20261024-1234abcd", "nightly-20261025-1234abcd", true}} {
		if got := updateIsNewer(test.channel, test.current, test.target); got != test.newer {
			t.Fatalf("%+v: got %v", test, got)
		}
	}
}

type updateTransport func(*http.Request) (*http.Response, error)

func (f updateTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestUpdateCommandOutput(t *testing.T) {
	oldVersion, oldTransport, oldStdin := Version, http.DefaultTransport, os.Stdin
	t.Cleanup(func() { Version = oldVersion; http.DefaultTransport = oldTransport; os.Stdin = oldStdin })
	input, err := os.Open(os.DevNull)
	if err != nil {
		t.Fatal(err)
	}
	defer input.Close()
	os.Stdin = input
	sha := strings.Repeat("a", 40)
	for _, tc := range []struct {
		name, channel, metadata, want, diagnostic string
		status                                    int
	}{
		{name: "already current", metadata: `{"tag_name":"v1.2.3"}`, want: "Current version: 1.2.3\nUpdate channel: stable\nAvailable version: 1.2.3\nNo newer version available: 1.2.3\n"},
		{name: "redirected input cancels", metadata: `{"tag_name":"v1.2.4"}`, want: "Current version: 1.2.3\nUpdate channel: stable\nAvailable version: 1.2.4\nUpdate cancelled.\n"},
		{name: "HTTP failure", status: 503, diagnostic: "Could not download https://api.github.com/repos/mukopikmin/sadoku/releases/latest: HTTP 503.\n"},
		{name: "invalid release JSON", metadata: `invalid`, diagnostic: "GitHub returned an invalid latest release response.\n"},
		{name: "invalid release tag", metadata: `{"tag_name":"oops"}`, diagnostic: "GitHub returned an invalid stable release tag: oops.\n"},
		{name: "missing release tag", metadata: `{}`, diagnostic: "GitHub returned an invalid stable release tag: undefined.\n"},
		{name: "nightly", channel: "nightly", metadata: `{"object":{"sha":"` + sha + `"}}`, want: "Current version: 1.2.3\nUpdate channel: nightly\nAvailable version: nightly-20260102-aaaaaaaa\nUpdate cancelled.\n"},
		{name: "invalid nightly metadata", channel: "nightly", metadata: `invalid`, diagnostic: "GitHub returned invalid nightly tag metadata.\n"},
		{name: "invalid nightly hash", channel: "nightly", metadata: `{}`, diagnostic: "GitHub returned an invalid nightly commit hash.\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			Version = "1.2.3"
			http.DefaultTransport = updateTransport(func(req *http.Request) (*http.Response, error) {
				body := tc.metadata
				if strings.Contains(req.URL.Path, "/commits/") {
					body = `{"commit":{"committer":{"date":"2026-01-02T00:00:00Z"}}}`
				}
				status := tc.status
				if status == 0 {
					status = 200
				}
				return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}, nil
			})
			var stdout, stderr bytes.Buffer
			if err := Update(context.Background(), tc.channel, &stdout); err != nil {
				WriteError(&stderr, err)
			}
			if stdout.String() != tc.want || stderr.String() != tc.diagnostic {
				t.Fatalf("stdout: %q\nstderr: %q", stdout.String(), stderr.String())
			}
		})
	}
}
func TestUpdateConfirmationOutput(t *testing.T) {
	for _, tc := range []struct {
		input              string
		terminal, accepted bool
	}{{"yes\n", true, true}, {"n\n", true, false}, {"", true, false}, {"yes\n", false, false}} {
		var out bytes.Buffer
		got := confirmUpdate(strings.NewReader(tc.input), &out, "1.2.3", tc.terminal)
		want := ""
		if tc.terminal {
			want = "Update Sadoku to 1.2.3? [y/N] "
		}
		if got != tc.accepted || out.String() != want {
			t.Fatalf("%+v: accepted=%v output=%q", tc, got, out.String())
		}
	}
}
