package tooling

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const testHead = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const testPrevious = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
const testTag = "cccccccccccccccccccccccccccccccccccccccc"

type scenario struct {
	main, commit, remoteObject, previousTag, previousCommit, root, approved, tagInfo, releases, remoteTags, fail, notes string
	noAncestor, existing, first, emptyReleases, emptyTags                                                               bool
	ci                                                                                                                  []ciRun
}

func releaseRunner(t *testing.T, s scenario) runner {
	t.Helper()
	fallback := func(s, def string) string {
		if s != "" {
			return s
		}
		return def
	}
	previous := fallback(s.previousTag, "v0.9.0")
	if s.first {
		previous = baselineTag
	}
	responses := map[string]string{
		"rev-parse HEAD": testHead,
		"for-each-ref --format=%(objecttype)%0a%(contents:trailers:key=Previous-Stable-Tag,valueonly) refs/tags/v0.10.0": fallback(s.tagInfo, "tag\n"+fallback(s.approved, previous)),
		"ls-remote --tags origin refs/tags/v*":                                                  fallback(s.remoteTags, testPrevious+"\trefs/tags/"+previous),
		"fetch --no-tags origin main":                                                           "",
		"rev-parse origin/main":                                                                 fallback(s.main, testHead),
		"rev-parse --verify refs/tags/v0.10.0":                                                  testTag,
		"rev-parse --verify refs/tags/v0.10.0^{commit}":                                         fallback(s.commit, testHead),
		"ls-remote --exit-code --tags origin refs/tags/v0.10.0":                                 fallback(s.remoteObject, testTag) + "\trefs/tags/v0.10.0",
		"rev-parse --verify refs/tags/" + previous + "^{commit}":                                fallback(s.previousCommit, testPrevious),
		"merge-base --is-ancestor " + fallback(s.previousCommit, testPrevious) + " " + testHead: "",
		"rev-list --max-parents=0 HEAD":                                                         fallback(s.root, testPrevious),
	}
	if s.first || s.emptyTags {
		responses["ls-remote --tags origin refs/tags/v*"] = ""
	}
	return func(command string, args ...string) commandResult {
		key := strings.Join(args, " ")
		if s.fail != "" && strings.Contains(command+" "+key, s.fail) {
			return commandResult{false, "", "command failed"}
		}
		if command == "git" {
			out, ok := responses[key]
			if !ok {
				t.Fatalf("unexpected git %s", key)
			}
			return commandResult{!(s.noAncestor && args[0] == "merge-base"), out, ""}
		}
		if command == "gh" {
			switch args[0] {
			case "repo":
				return commandResult{true, "owner/sadoku", ""}
			case "run":
				ci := s.ci
				if ci == nil {
					ci = []ciRun{{1, "Test", "main", "push", "completed", "success", testHead, "https://example.test/run"}}
				}
				data, _ := json.Marshal(ci)
				return commandResult{true, string(data), ""}
			case "api":
				if strings.Contains(key, "POST") {
					if !strings.Contains(key, "tag_name=v0.10.0") || !strings.Contains(key, "target_commitish="+testHead) || !strings.Contains(key, "previous_tag_name="+previous) {
						t.Fatalf("incorrect notes range: %s", key)
					}
					return commandResult{true, fallback(s.notes, `{"name":"v0.10.0","body":"Changes since v0.9.0"}`), ""}
				}
				var releases []string
				if !s.first && !s.emptyReleases {
					data, _ := json.Marshal(release{previous, false, false})
					releases = append(releases, string(data))
				}
				if s.existing {
					data, _ := json.Marshal(release{"v0.10.0", true, false})
					releases = append(releases, string(data))
				}
				return commandResult{true, fallback(s.releases, strings.Join(releases, "\n")), ""}
			}
		}
		t.Fatalf("unexpected command %s %s", command, key)
		return commandResult{}
	}
}
func TestReleaseInspection(t *testing.T) {
	cases := []struct {
		name   string
		s      scenario
		failed string
	}{
		{"valid", scenario{}, ""}, {"stale-main", scenario{main: testPrevious}, "remoteMain"},
		{"changed-commit", scenario{commit: testPrevious}, "releaseTag"}, {"changed-object", scenario{remoteObject: testPrevious}, "releaseTag"},
		{"draft-exists", scenario{existing: true}, "releaseAbsent"}, {"not-ancestor", scenario{noAncestor: true}, "notesBaseline"},
		{"same-commit", scenario{previousCommit: testHead}, "notesBaseline"}, {"older-version", scenario{previousTag: "v0.11.0"}, "newerVersion"},
		{"first-release", scenario{first: true}, ""}, {"wrong-root", scenario{first: true, root: testHead}, "notesBaseline"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r, err := inspectRelease("0.10.0", releaseRunner(t, tc.s))
			if err != nil {
				t.Fatal(err)
			}
			if r.OK != (tc.failed == "") {
				t.Fatalf("unexpected result: %+v", r)
			}
			if tc.failed != "" {
				found := false
				for _, c := range r.Checks {
					if c.Name == tc.failed {
						found = !c.OK
					}
				}
				if !found {
					t.Fatalf("missing failed check %s", tc.failed)
				}
			}
		})
	}
}
func TestReleaseRequiresExactCI(t *testing.T) {
	good := ciRun{1, "Test", "main", "push", "completed", "success", testHead, "https://example.test/run"}
	cases := []ciRun{good, good, good, good, good, good, good, good}
	cases[0].DatabaseID = 0
	cases[1].WorkflowName = "Other"
	cases[2].HeadBranch = "tag"
	cases[3].Event = "pull_request"
	cases[4].Status = "in_progress"
	cases[5].Conclusion = "failure"
	cases[6].HeadSHA = testPrevious
	cases[7].URL = ""
	for i, c := range cases {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			r, err := inspectRelease("0.10.0", releaseRunner(t, scenario{ci: []ciRun{c}}))
			if err != nil || r.OK {
				t.Fatalf("accepted invalid CI: %+v %v", r, err)
			}
			if !strings.Contains(r.Checks[5].Actual, "returned runs:") {
				t.Fatal("missing diagnostics")
			}
		})
	}
	r, err := inspectRelease("0.10.0", releaseRunner(t, scenario{ci: []ciRun{}}))
	if err != nil || r.OK {
		t.Fatal("accepted missing CI", err)
	}
}
func TestReleaseFailsClosed(t *testing.T) {
	for _, fail := range []string{"gh api", "git fetch", "git ls-remote --exit-code", "gh run", "git ls-remote --tags", "git for-each-ref"} {
		t.Run(fail, func(t *testing.T) {
			_, err := inspectRelease("0.10.0", releaseRunner(t, scenario{fail: fail}))
			if err == nil || !strings.Contains(err.Error(), "command failed") {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
	for _, s := range []scenario{{emptyReleases: true}, {approved: "v0.8.0"}, {emptyReleases: true, emptyTags: true}, {releases: "malformed JSON"}} {
		if _, err := inspectRelease("0.10.0", releaseRunner(t, s)); err == nil {
			t.Fatal("accepted inconsistent context")
		}
		output := filepath.Join(t.TempDir(), "notes.json")
		if err := generateNotes("0.10.0", output, releaseRunner(t, s)); err == nil {
			t.Fatal("generated inconsistent notes")
		}
		if _, err := os.Stat(output); !os.IsNotExist(err) {
			t.Fatal("wrote notes on failure")
		}
	}
}
func TestReleaseArgumentsAndBaseline(t *testing.T) {
	for _, v := range []string{"v0.1.0", "01.0.0", "0.01.0", "0.1.00", "0.1.0-rc.1", "0.1.0+build.1"} {
		if err := Run([]string{"release-check", "--version", v}); err == nil {
			t.Fatal("accepted", v)
		}
	}
	if err := Run([]string{"release-notes", "--version", "0.1.0"}); err == nil {
		t.Fatal("accepted missing output")
	}
	for _, s := range []string{"", "commit\nv0.9.0", "tag", "tag\nv0.9.0\nv0.9.0", "tag\nv0.9.0\nv1.0.0", "tag\nv01.0.0", "tag\nnightly", "tag\nv0.9.0-nightly"} {
		if _, err := readApprovedBaseline(s); err == nil {
			t.Fatal("accepted", s)
		}
	}
	for _, s := range []string{"v0.9.0", baselineTag} {
		if got, err := readApprovedBaseline("tag\n" + s + "\n"); err != nil || got != s {
			t.Fatal(got, err)
		}
	}
	if got := selectPreviousStableTag([]release{{"nightly", false, false}, {"v0.3.0", true, false}, {"v0.2.0", false, false}, {"v0.1.0", false, false}}); got != "v0.2.0" {
		t.Fatal(got)
	}
	if !isNewerVersion("999999999999999999999.0.0", "v1.0.0") {
		t.Fatal("version overflow")
	}
}
func TestGenerateNotes(t *testing.T) {
	output := filepath.Join(t.TempDir(), "notes.json")
	if err := generateNotes("0.10.0", output, releaseRunner(t, scenario{})); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(output)
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]string
	if err = json.Unmarshal(data, &result); err != nil {
		t.Fatal(err)
	}
	if result["headSha"] != testHead || result["previousStableTag"] != "v0.9.0" || result["body"] != "Changes since v0.9.0" {
		t.Fatal(result)
	}
	for _, notes := range []string{`{}`, `{"body":""}`, `{"body":" \n"}`, `malformed`} {
		if err = generateNotes("0.10.0", output, releaseRunner(t, scenario{notes: notes})); err == nil {
			t.Fatal("accepted empty notes")
		}
		unchanged, _ := os.ReadFile(output)
		if string(unchanged) != string(data) {
			t.Fatal("replaced existing notes on failure")
		}
	}
}
