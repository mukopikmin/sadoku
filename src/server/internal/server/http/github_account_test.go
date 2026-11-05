package http_test

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestMain(m *testing.M) {
	if os.Getenv("SADOKU_HTTP_GH_HELPER") == "1" {
		if path := os.Getenv("SADOKU_HTTP_GH_RESPONSES"); path != "" {
			data, err := os.ReadFile(path)
			var responses map[string]json.RawMessage
			if err != nil || json.Unmarshal(data, &responses) != nil {
				os.Exit(2)
			}
			endpoint := os.Args[len(os.Args)-1]
			response, ok := responses[endpoint]
			if !ok {
				fmt.Fprint(os.Stderr, "Unexpected fixture GitHub command: "+endpoint)
				os.Exit(2)
			}
			var text string
			if json.Unmarshal(response, &text) == nil {
				fmt.Fprint(os.Stdout, text)
			} else {
				os.Stdout.Write(response)
			}
			os.Exit(0)
		}
		fmt.Fprint(os.Stdout, os.Getenv("SADOKU_HTTP_GH_STDOUT"))
		fmt.Fprint(os.Stderr, os.Getenv("SADOKU_HTTP_GH_STDERR"))
		if os.Getenv("SADOKU_HTTP_GH_FAIL") == "1" {
			os.Exit(1)
		}
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func installHTTPGitHubFixture(t *testing.T, directory string) {
	t.Helper()
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	name := "gh"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	target := filepath.Join(directory, name)
	// An executing Windows image cannot be removed through a hard-link alias.
	linked := runtime.GOOS != "windows" && os.Link(executable, target) == nil
	if !linked {
		source, err := os.Open(executable)
		if err != nil {
			t.Fatal(err)
		}
		defer source.Close()
		file, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0700)
		if err != nil {
			t.Fatal(err)
		}
		_, copyErr := io.Copy(file, source)
		closeErr := file.Close()
		if copyErr != nil {
			t.Fatal(copyErr)
		}
		if closeErr != nil {
			t.Fatal(closeErr)
		}
	}
	t.Setenv("PATH", directory)
	t.Setenv("SADOKU_HTTP_GH_HELPER", "1")
	t.Setenv("SADOKU_HTTP_GH_STDOUT", "")
	t.Setenv("SADOKU_HTTP_GH_STDERR", "not authenticated")
	t.Setenv("SADOKU_HTTP_GH_FAIL", "1")
	t.Setenv("SADOKU_HTTP_GH_RESPONSES", "")
	t.Setenv("GORACE", "atexit_sleep_ms=0")
}

func TestGitHubAccountWithoutCLIIsServerError(t *testing.T) {
	_, server, _ := setup(t)
	t.Setenv("PATH", t.TempDir())
	body := restRequest(t, server.URL, "GET", "/__sadoku/github-account", "", "", 500)
	if string(body) != "Internal Server Error" {
		t.Fatalf("missing gh response: %s", body)
	}
}

func TestGitHubAccountPreservesDiagnosticsAndOptionalFields(t *testing.T) {
	_, server, _ := setup(t)
	installHTTPGitHubFixture(t, t.TempDir())
	for _, test := range []struct {
		name, stdout, stderr, fail string
		want                       string
	}{
		{"command error", "", "not authenticated", "1", `{"ok":false,"message":"not authenticated"}`},
		{"empty diagnostic", "", "", "1", `{"ok":false,"message":"GitHub CLI authentication is unavailable."}`},
		{"invalid JSON", "{", "", "", `{"ok":false,"message":"GitHub returned an invalid account."}`},
		{"missing login", `{"name":"Name"}`, "", "", `{"ok":false,"message":"GitHub returned an invalid account."}`},
		{"optional values", `{"login":"viewer","name":null,"avatar_url":""}`, "", "", `{"ok":true,"account":{"login":"viewer"}}`},
		{"valid account", `{"login":"viewer","name":"Name","avatar_url":"https://example.com/avatar"}`, "", "", `{"ok":true,"account":{"login":"viewer","name":"Name","avatarUrl":"https://example.com/avatar"}}`},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("SADOKU_HTTP_GH_STDOUT", test.stdout)
			t.Setenv("SADOKU_HTTP_GH_STDERR", test.stderr)
			t.Setenv("SADOKU_HTTP_GH_FAIL", test.fail)
			got := restRequest(t, server.URL, "GET", "/__sadoku/github-account", "", "", 200)
			var gotJSON, wantJSON any
			if err := json.Unmarshal(got, &gotJSON); err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal([]byte(test.want), &wantJSON); err != nil {
				t.Fatal(err)
			}
			gotBytes, _ := json.Marshal(gotJSON)
			wantBytes, _ := json.Marshal(wantJSON)
			if string(gotBytes) != string(wantBytes) {
				t.Fatalf("account: got %s; want %s", gotBytes, wantBytes)
			}
		})
	}
}
