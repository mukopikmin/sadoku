package session

import (
	"context"
	"encoding/json"
	"os"
	"reflect"
	"testing"

	"github.com/mukopikmin/sadoku/src/server/config"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

type sourceRepository struct {
	u.Repository
	ensured string
}

func (r *sourceRepository) Ensure(path string) (u.Document, error) {
	r.ensured = path
	return u.Document{ID: 1, FilePath: path}, nil
}

func TestLegacySourceTranscripts(t *testing.T) {
	var fixture struct {
		Reference string
		Cases     []struct {
			Input, Identity, Fetch string
			Remote                 bool
			Title                  *string
			Pull                   *struct {
				Owner, Repo, URL string
				PullNumber       int
			}
		}
	}
	b, err := os.ReadFile("testdata/legacy_sources.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(b, &fixture); err != nil {
		t.Fatal(err)
	}
	if fixture.Reference != "368b47eb1ae18a84d428ce4367d25cb815584968" {
		t.Fatal("unknown source reference")
	}
	for _, test := range fixture.Cases {
		t.Run(test.Input, func(t *testing.T) {
			identity, fetch, remote := Source(test.Input)
			if remote != test.Remote || (remote && (identity != test.Identity || fetch != test.Fetch)) {
				t.Errorf("source: got (%q,%q,%v); want (%q,%q,%v)", identity, fetch, remote, test.Identity, test.Fetch, test.Remote)
			}
			pull := ParsePull(test.Input)
			if (pull == nil) != (test.Pull == nil) {
				t.Fatalf("pull recognition: %+v; want %+v", pull, test.Pull)
			}
			if pull != nil && !reflect.DeepEqual([]any{pull.Owner, pull.Repo, pull.URL, pull.Number}, []any{test.Pull.Owner, test.Pull.Repo, test.Pull.URL, test.Pull.PullNumber}) {
				t.Errorf("pull: %+v; want %+v", pull, test.Pull)
			}
			if test.Title != nil {
				repo := new(sourceRepository)
				s, err := New(context.Background(), test.Input, repo, config.Defaults())
				if err != nil {
					t.Fatal(err)
				}
				if len(s.Documents) != 1 || s.Documents[0].Title != *test.Title || s.Documents[0].RelativePath != *test.Title || repo.ensured != test.Identity || s.Sources[1] != test.Fetch {
					t.Errorf("session: %+v; stored %q, fetch %q; want title %q, identity %q, fetch %q", s.Documents, repo.ensured, s.Sources[1], *test.Title, test.Identity, test.Fetch)
				}
			}
		})
	}
}
