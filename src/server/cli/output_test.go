package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
)

// Captured from 368b47e (the last TypeScript server). Only timestamps and the
// temporary root are normalized; whitespace, field order and stderr are exact.
// Historical instruction commands assert generic invalid-command errors.
func TestLegacyCLITranscripts(t *testing.T) {
	data, err := os.ReadFile("testdata/legacy_cli.json")
	if err != nil {
		t.Fatal(err)
	}
	help, err := os.ReadFile("testdata/legacy_help.txt")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Args           []string
		Files          map[string]string
		Stdout, Stderr string
		Code           int
	}
	if err = json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	t.Setenv("SADOKU_COMMENTS_DIR", filepath.Join(root, "comments"))
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(root, "config"))
	t.Setenv("APPDATA", "")
	if err = os.WriteFile(filepath.Join(root, "doc.md"), []byte("# タイトル\nBody <&>\n"), 0600); err != nil {
		t.Fatal(err)
	}
	timestamp := regexp.MustCompile(`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z`)
	quotedRoot, _ := json.Marshal(root)
	normalize := func(s string) string {
		s = strings.ReplaceAll(s, string(quotedRoot[1:len(quotedRoot)-1]), "$ROOT")
		s = strings.ReplaceAll(s, root, "$ROOT")
		if runtime.GOOS == "windows" {
			// The captured paths are POSIX paths; preserve native CLI paths while
			// normalizing their first separator in both JSON and plain messages.
			s = strings.ReplaceAll(s, "$ROOT\\\\", "$ROOT/")
			s = strings.ReplaceAll(s, "$ROOT\\", "$ROOT/")
		}
		return timestamp.ReplaceAllString(s, "$$TIME")
	}
	for i, tc := range cases {
		// Preserve historical captures while checking the current command set.
		if len(tc.Args) > 0 && tc.Args[0] == "instruction" {
			tc.Stdout = ""
			tc.Stderr = "Invalid instruction command.\n$HELP"
			tc.Code = 1
		}
		t.Run(fmt.Sprintf("%03d_%s", i, strings.Join(tc.Args, " ")), func(t *testing.T) {
			for name, body := range tc.Files {
				if err := os.WriteFile(filepath.Join(root, name), []byte(body), 0600); err != nil {
					t.Fatal(err)
				}
			}
			args := append([]string{}, tc.Args...)
			for i, arg := range args {
				args[i] = strings.ReplaceAll(arg, "$ROOT", root)
			}
			var stdout, stderr bytes.Buffer
			code := 0
			if err := Execute(context.Background(), args, &stdout, nil); err != nil {
				WriteError(&stderr, err)
				code = 1
			}
			for _, stream := range []struct{ name, want, got string }{{"stdout", tc.Stdout, normalize(stdout.String())}, {"stderr", tc.Stderr, normalize(stderr.String())}} {
				stream.want = strings.ReplaceAll(stream.want, "$HELP", string(help))
				if stream.want != stream.got {
					offset := 0
					for offset < len(stream.want) && offset < len(stream.got) && stream.want[offset] == stream.got[offset] {
						offset++
					}
					start := max(0, offset-60)
					t.Errorf("%s differs at byte %d\nwant: %q\n got: %q", stream.name, offset, stream.want[start:min(len(stream.want), offset+220)], stream.got[start:min(len(stream.got), offset+220)])
				}
			}
			if code != tc.Code {
				t.Errorf("exit code = %d, want %d", code, tc.Code)
			}
		})
	}
}
