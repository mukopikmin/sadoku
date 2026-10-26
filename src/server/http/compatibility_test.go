package http_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"

	pb "github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1"
	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	httpadapter "github.com/mukopikmin/sadoku/src/server/http"
	"github.com/mukopikmin/sadoku/src/server/session"
	"github.com/mukopikmin/sadoku/src/server/storage"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

// Responses captured from the final TypeScript backend at the fixture's
// reference commit. Compare JSON fields/types, errors, status, and cache policy;
// normalize only temporary roots, timestamps, and physical SQLite file size.
// Keep no-store on all dynamic responses, including legacy responses without it.
type legacyHTTPResponse struct {
	Status                          int
	ContentType, CacheControl, Text string
	JSON                            json.RawMessage
}

func TestLegacyHTTPTranscripts(t *testing.T) {
	var fixture struct {
		Reference string
		Profiles  []struct {
			Name            string
			GitHubResponses map[string]json.RawMessage
			Steps           []struct {
				Name, Method, Path, Write, Remove, Content string
				Mkdir, Link, Target                        string
				Bytes                                      []byte
				Body                                       json.RawMessage
				RawBody                                    *string
				Headers                                    map[string]string
				Expected                                   legacyHTTPResponse
				AcceptedDifference                         string
				GoExpected                                 *legacyHTTPResponse
			}
		}
	}
	b, err := os.ReadFile("testdata/legacy_http.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(b, &fixture); err != nil {
		t.Fatal(err)
	}
	if fixture.Reference != "368b47eb1ae18a84d428ce4367d25cb815584968" {
		t.Fatal("unknown legacy reference")
	}
	covered := map[string]bool{}
	for _, profile := range fixture.Profiles {
		for _, step := range profile.Steps {
			if strings.HasPrefix(step.Path, "/sadoku.preview.v1.PreviewService/") {
				covered[strings.TrimPrefix(step.Path, "/sadoku.preview.v1.PreviewService/")] = true
			}
		}
	}
	methods := pb.File_sadoku_preview_v1_preview_proto.Services().ByName("PreviewService").Methods()
	for i := 0; i < methods.Len(); i++ {
		if !covered[string(methods.Get(i).Name())] {
			t.Errorf("missing legacy RPC transcript: %s", methods.Get(i).Name())
		}
	}
	for _, profile := range fixture.Profiles {
		t.Run(profile.Name, func(t *testing.T) {
			directory := t.TempDir()
			root := filepath.Join(directory, "docs")
			if err := os.MkdirAll(filepath.Join(root, "guides"), 0700); err != nil {
				t.Fatal(err)
			}
			for name, contents := range map[string]string{"readme.md": "# Title\nBody\n", "second.md": "# Other\nOther body\n"} {
				if err := os.WriteFile(filepath.Join(root, name), []byte(contents), 0600); err != nil {
					t.Fatal(err)
				}
			}
			t.Setenv("SADOKU_COMMENTS_DIR", filepath.Join(directory, "comments"))
			t.Setenv("XDG_CONFIG_HOME", filepath.Join(directory, "config"))
			t.Setenv("APPDATA", "")
			installHTTPGitHubFixture(t, directory)
			source := root
			if profile.GitHubResponses != nil {
				responses, _ := json.Marshal(profile.GitHubResponses)
				path := filepath.Join(directory, "github.json")
				if err := os.WriteFile(path, responses, 0600); err != nil {
					t.Fatal(err)
				}
				t.Setenv("SADOKU_HTTP_GH_RESPONSES", path)
				source = "https://github.com/owner/repo/pull/1"
			}
			database, err := db.Open(filepath.Join(directory, "comments", "sadoku.sqlite3"))
			if err != nil {
				t.Fatal(err)
			}
			defer database.Close()
			repo := &storage.Repository{DB: database, Path: filepath.Join(directory, "comments", "sadoku.sqlite3")}
			s, err := session.New(context.Background(), source, repo, config.Defaults())
			if err != nil {
				t.Fatal(err)
			}
			s.Prepare(context.Background(), config.Defaults())
			for id, content := range []string{"Saved memory", "Other memory"} {
				if profile.GitHubResponses != nil {
					break
				}
				if _, err := repo.SaveNote("memory", u.Note{DocumentID: int64(id + 1), Content: content}); err != nil {
					t.Fatal(err)
				}
			}
			handler, err := httpadapter.New(s, httpadapter.Options{TrustForwardedPrefix: true})
			if err != nil {
				t.Fatal(err)
			}
			uriPath := filepath.ToSlash(root)
			if filepath.VolumeName(root) != "" {
				uriPath = "/" + uriPath
			}
			rootURI := (&url.URL{Scheme: "file", Path: uriPath}).String()
			stamp := regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$`)
			var normalize func(string, any) any
			normalize = func(key string, value any) any {
				if key == "databaseSize" {
					return "$DATABASE_SIZE"
				}
				switch value := value.(type) {
				case string:
					if (key == "createdAt" || key == "updatedAt" || key == "recordedAt" || key == "resolvedAt") && stamp.MatchString(value) {
						return "$TIME"
					}
					value = strings.ReplaceAll(value, rootURI, "$FILE_ROOT")
					value = strings.ReplaceAll(value, root, "$ROOT")
					if strings.Contains(value, "$ROOT") {
						value = filepath.ToSlash(value)
					}
					return value
				case []any:
					for i, v := range value {
						value[i] = normalize("", v)
					}
				case map[string]any:
					for k, v := range value {
						value[k] = normalize(k, v)
					}
				}
				return value
			}
			createdAt := ""
			for _, step := range profile.Steps {
				if step.Link != "" {
					if err := os.Symlink(filepath.Join(root, step.Target), filepath.Join(root, step.Link)); err != nil {
						t.Skipf("symbolic links unavailable: %v", err)
					}
					continue
				}
				if step.Write != "" {
					data := []byte(step.Content)
					if step.Bytes != nil {
						data = step.Bytes
					}
					if err := os.WriteFile(filepath.Join(root, step.Write), data, 0600); err != nil {
						t.Fatal(err)
					}
					continue
				}
				if step.Mkdir != "" {
					if err := os.Mkdir(filepath.Join(root, step.Mkdir), 0700); err != nil {
						t.Fatal(err)
					}
					continue
				}
				if step.Remove != "" {
					if err := os.Remove(filepath.Join(root, step.Remove)); err != nil {
						t.Fatal(err)
					}
					continue
				}
				t.Run(step.Name, func(t *testing.T) {
					expected := step.Expected
					if step.GoExpected != nil {
						switch step.AcceptedDifference {
						case "deleted-live-snapshot", "tag-replacement-rollback":
							expected = *step.GoExpected
						default:
							t.Fatalf("unapproved compatibility difference: %q", step.AcceptedDifference)
						}
					}
					body := bytes.ReplaceAll(step.Body, []byte("$COMMENT_CREATED_AT"), []byte(createdAt))
					request := httptest.NewRequest(step.Method, step.Path, bytes.NewReader(body))
					if step.RawBody != nil {
						request = httptest.NewRequest(step.Method, step.Path, strings.NewReader(*step.RawBody))
					}
					if step.Body != nil {
						request.Header.Set("Content-Type", "application/json")
					}
					if strings.HasPrefix(step.Path, "/sadoku.") {
						request.Header.Set("Connect-Protocol-Version", "1")
					}
					for key, value := range step.Headers {
						request.Header.Set(key, value)
					}
					response := httptest.NewRecorder()
					handler.ServeHTTP(response, request)
					if strings.HasSuffix(step.Path, "/CreateComment") && response.Code == 200 {
						var comment struct{ CreatedAt string }
						if err := json.Unmarshal(response.Body.Bytes(), &comment); err != nil {
							t.Fatal(err)
						}
						createdAt = comment.CreatedAt
					}
					if response.Code != expected.Status || strings.ToLower(response.Header().Get("Content-Type")) != expected.ContentType || (response.Header().Get("Cache-Control") != expected.CacheControl && !(expected.CacheControl == "" && response.Header().Get("Cache-Control") == "no-store")) {
						t.Errorf("metadata: got %d %q %q; want %d %q %q", response.Code, response.Header().Get("Content-Type"), response.Header().Get("Cache-Control"), expected.Status, expected.ContentType, expected.CacheControl)
					}
					if expected.JSON != nil {
						var got, want any
						if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
							t.Fatalf("invalid JSON: %s", response.Body)
						}
						if err := json.Unmarshal(expected.JSON, &want); err != nil {
							t.Fatal(err)
						}
						got = normalize("", got)
						if !reflect.DeepEqual(got, want) {
							gotJSON, _ := json.Marshal(got)
							wantJSON, _ := json.Marshal(want)
							t.Errorf("response:\n got %s\nwant %s", gotJSON, wantJSON)
						}
					} else if got := normalize("", response.Body.String()); got != expected.Text {
						t.Errorf("text: got %q; want %q", got, expected.Text)
					}
				})
			}
		})
	}
}
