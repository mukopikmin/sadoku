package tooling

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

const testHead = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const testPrevious = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
const testTag = "cccccccccccccccccccccccccccccccccccccccc"
const releaseListCommand = "gh api --paginate repos/owner/sadoku/releases?per_page=100 --jq .[] | {tagName: .tag_name, isDraft: .draft, isPrerelease: .prerelease}"
const releaseCICommand = "gh run list --repo owner/sadoku --workflow test.yml --branch main --event push --commit " + testHead + " --limit 1 --json databaseId,workflowName,headBranch,event,status,conclusion,headSha,url"
const releaseTagCommand = "git for-each-ref --format=%(objecttype)%0a%(contents:trailers:key=Previous-Stable-Tag,valueonly) refs/tags/v0.10.0"

type releaseReply struct {
	Text   string
	Status int
}

func releaseCommands(previous string) map[string]releaseReply {
	releases := `{"tagName":"` + previous + `","isDraft":false,"isPrerelease":false}`
	remote := testPrevious + "\trefs/tags/" + previous
	if previous == "release-notes-baseline" {
		releases = ""
		remote = ""
	}
	return map[string]releaseReply{
		"git rev-parse HEAD": {testHead, 0},
		"gh repo view --json nameWithOwner --jq .nameWithOwner": {"owner/sadoku", 0},
		releaseTagCommand:                          {"tag\n" + previous, 0},
		releaseListCommand:                         {releases, 0},
		"git ls-remote --tags origin refs/tags/v*": {remote, 0},
		"git rev-parse --verify refs/tags/" + previous + "^{commit}":    {testPrevious, 0},
		"git fetch --no-tags origin main":                               {"", 0},
		"git rev-parse origin/main":                                     {testHead, 0},
		"git rev-parse --verify refs/tags/v0.10.0":                      {testTag, 0},
		"git rev-parse --verify refs/tags/v0.10.0^{commit}":             {testHead, 0},
		"git ls-remote --exit-code --tags origin refs/tags/v0.10.0":     {testTag + "\trefs/tags/v0.10.0", 0},
		"git merge-base --is-ancestor " + testPrevious + " " + testHead: {"", 0},
		"git rev-list --max-parents=0 HEAD":                             {testPrevious, 0},
		releaseCICommand:                                                {`[{"databaseId":1,"workflowName":"Test","headBranch":"main","event":"push","status":"completed","conclusion":"success","headSha":"` + testHead + `","url":"https://example.test/run"}]`, 0},
		"gh api --method POST repos/owner/sadoku/releases/generate-notes -f tag_name=v0.10.0 -f target_commitish=" + testHead + " -f previous_tag_name=" + previous: {`{"name":"v0.10.0","body":"Changes"}`, 0},
	}
}

// Only the git/gh boundary is replaced. All assertions exercise the real shell script.
func runRelease(t *testing.T, commands map[string]releaseReply, args ...string) (string, string, error) {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("Unix release tooling")
	}
	for _, name := range []string{"bash", "jq", "make"} {
		if _, err := exec.LookPath(name); err != nil {
			t.Fatalf("required test command %s: %v", name, err)
		}
	}
	dir := t.TempDir()
	data, err := json.Marshal(commands)
	if err != nil {
		t.Fatal(err)
	}
	replies := filepath.Join(dir, "replies.json")
	writeTestFile(t, replies, string(data), 0644)
	stub := `#!/bin/sh
exec jq -jr --arg key "${0##*/} $*" '
 if has($key) then .[$key] as $reply |
   if $reply.Status == 0 then $reply.Text else $reply.Text | halt_error($reply.Status) end
 else error("Unexpected command: " + $key) end' "$SADOKU_RELEASE_REPLIES"
`
	for _, name := range []string{"git", "gh"} {
		writeTestFile(t, filepath.Join(dir, name), stub, 0755)
	}
	script, err := filepath.Abs("../../scripts/release.sh")
	if err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command("bash", append([]string{script}, args...)...)
	// Exercise Make's argument forwarding and ensure its output remains valid JSON.
	root := filepath.Dir(filepath.Dir(script))
	if len(args) == 3 && args[0] == "check" && args[1] == "--version" {
		cmd = exec.Command("make", "--no-print-directory", "-C", root, "release-check", "VERSION="+args[2])
	} else if len(args) == 5 && args[0] == "notes" && args[1] == "--version" && args[3] == "--output" {
		cmd = exec.Command("make", "--no-print-directory", "-C", root, "release-notes", "VERSION="+args[2], "OUTPUT="+args[4])
	}
	cmd.Env = append(os.Environ(), "PATH="+dir+string(os.PathListSeparator)+os.Getenv("PATH"), "SADOKU_RELEASE_REPLIES="+replies)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	stdout, err := cmd.Output()
	return string(stdout), stderr.String(), err
}
func rejectRelease(t *testing.T, commands map[string]releaseReply, want string) {
	t.Helper()
	out, stderr, err := runRelease(t, commands, "check", "--version", "0.10.0")
	if err == nil || out != "" || !strings.Contains(stderr, want) {
		t.Fatalf("expected %q rejection; output=%s stderr=%s error=%v", want, out, stderr, err)
	}
}
func TestReleaseCheck(t *testing.T) {
	for _, previous := range []string{"v0.9.0", "release-notes-baseline"} {
		t.Run(previous, func(t *testing.T) {
			out, stderr, err := runRelease(t, releaseCommands(previous), "check", "--version", "0.10.0")
			if err != nil {
				t.Fatal(err, stderr)
			}
			var result map[string]string
			if err = json.Unmarshal([]byte(out), &result); err != nil {
				t.Fatal(err)
			}
			want := map[string]string{"version": "0.10.0", "tag": "v0.10.0", "headSha": testHead, "tagObject": testTag, "previousStableTag": previous}
			if len(result) != len(want) {
				t.Fatal("unexpected report fields", result)
			}
			for key, value := range want {
				if result[key] != value {
					t.Fatal(result)
				}
			}
		})
	}
	cases := []struct {
		name, command, text, message string
		status                       int
	}{
		{"stale-main", "git rev-parse origin/main", testPrevious, "must match origin/main", 0},
		{"changed-commit", "git rev-parse --verify refs/tags/v0.10.0^{commit}", testPrevious, "must point to HEAD", 0},
		{"changed-tag", "git ls-remote --exit-code --tags origin refs/tags/v0.10.0", testPrevious + "\trefs/tags/v0.10.0", "differs on origin", 0},
		{"same-commit", "git rev-parse --verify refs/tags/v0.9.0^{commit}", testHead, "earlier commit", 0},
		{"not-ancestor", "git merge-base --is-ancestor " + testPrevious + " " + testHead, "", "must be an ancestor", 1},
		{"merge-base-error", "git merge-base --is-ancestor " + testPrevious + " " + testHead, "git error", "must be an ancestor", 128},
		{"draft-release", releaseListCommand, `{"tagName":"v0.9.0","isDraft":false,"isPrerelease":false}
{"tagName":"v0.10.0","isDraft":true,"isPrerelease":false}`, "already exists", 0},
		{"missing-ci", releaseCICommand, "[]", "No successful Test", 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			commands := releaseCommands("v0.9.0")
			commands[tc.command] = releaseReply{tc.text, tc.status}
			rejectRelease(t, commands, tc.message)
		})
	}
	for _, previous := range []string{"v0.11.0", "v0.999999999999999999999.0"} {
		rejectRelease(t, releaseCommands(previous), "must be newer")
	}
	first := releaseCommands("release-notes-baseline")
	first["git rev-list --max-parents=0 HEAD"] = releaseReply{testHead, 0}
	rejectRelease(t, first, "repository root")
}
func TestReleaseCIMetadata(t *testing.T) {
	for key, value := range map[string]any{"databaseId": 0, "workflowName": "Other", "headBranch": "tag", "event": "pull_request", "status": "in_progress", "conclusion": "failure", "headSha": testPrevious, "url": ""} {
		t.Run(key, func(t *testing.T) {
			commands := releaseCommands("v0.9.0")
			var runs []map[string]any
			if err := json.Unmarshal([]byte(commands[releaseCICommand].Text), &runs); err != nil {
				t.Fatal(err)
			}
			runs[0][key] = value
			data, err := json.Marshal(runs)
			if err != nil {
				t.Fatal(err)
			}
			commands[releaseCICommand] = releaseReply{string(data), 0}
			rejectRelease(t, commands, "No successful Test")
		})
	}
}
func TestReleaseBaselineAndFailures(t *testing.T) {
	for _, info := range []string{"", "commit\nv0.9.0", "tag", "tag\nv0.9.0\nv0.9.0", "tag\nv0.9.0\nv1.0.0", "tag\nv01.0.0", "tag\nnightly", "tag\nv0.9.0-nightly"} {
		commands := releaseCommands("v0.9.0")
		commands[releaseTagCommand] = releaseReply{info, 0}
		rejectRelease(t, commands, "Previous-Stable-Tag")
	}
	for _, command := range []string{"git rev-parse HEAD", "gh repo view --json nameWithOwner --jq .nameWithOwner", releaseTagCommand, releaseListCommand, "git ls-remote --tags origin refs/tags/v*", "git fetch --no-tags origin main", "git ls-remote --exit-code --tags origin refs/tags/v0.10.0", releaseCICommand} {
		commands := releaseCommands("v0.9.0")
		commands[command] = releaseReply{"command failed", 1}
		rejectRelease(t, commands, "command failed")
	}
	for _, tc := range []struct{ command, text, message string }{
		{releaseListCommand, "", "Stable tags exist"},
		{releaseListCommand, "malformed JSON", "parse error"},
		{releaseTagCommand, "tag\nv0.8.0", "differs from the approved"},
	} {
		commands := releaseCommands("v0.9.0")
		commands[tc.command] = releaseReply{tc.text, 0}
		rejectRelease(t, commands, tc.message)
		output := filepath.Join(t.TempDir(), "notes.json")
		_, _, err := runRelease(t, commands, "notes", "--version", "0.10.0", "--output", output)
		if err == nil {
			t.Fatal("generated notes for invalid baseline")
		}
		if _, err = os.Stat(output); !os.IsNotExist(err) {
			t.Fatal("wrote notes on failure")
		}
	}
	commands := releaseCommands("v0.9.0")
	commands[releaseListCommand] = releaseReply{`{"tagName":"nightly","isDraft":false,"isPrerelease":false}
{"tagName":"v0.11.0","isDraft":true,"isPrerelease":false}
{"tagName":"v0.10.0-rc.1","isDraft":false,"isPrerelease":true}
{"tagName":"v0.9.0","isDraft":false,"isPrerelease":false}`, 0}
	if _, stderr, err := runRelease(t, commands, "check", "--version", "0.10.0"); err != nil {
		t.Fatal(err, stderr)
	}
}
func TestReleaseArguments(t *testing.T) {
	for _, version := range []string{"v0.1.0", "01.0.0", "0.01.0", "0.1.00", "0.1.0-rc.1", "0.1.0+build.1"} {
		_, _, err := runRelease(t, releaseCommands("v0.9.0"), "check", "--version", version)
		if err == nil {
			t.Fatal("accepted", version)
		}
	}
	for _, args := range [][]string{{}, {"unknown"}, {"check", "--version"}, {"check", "--unknown"}, {"notes", "--version", "0.10.0"}} {
		if _, _, err := runRelease(t, releaseCommands("v0.9.0"), args...); err == nil {
			t.Fatal("accepted", args)
		}
	}
}
func TestReleaseNotes(t *testing.T) {
	output := filepath.Join(t.TempDir(), "notes with spaces.json")
	commands := releaseCommands("v0.9.0")
	if _, stderr, err := runRelease(t, commands, "notes", "--version", "0.10.0", "--output", output); err != nil {
		t.Fatal(err, stderr)
	}
	data := readTestFile(t, output)
	var result map[string]string
	if err := json.Unmarshal([]byte(data), &result); err != nil {
		t.Fatal(err)
	}
	if result["headSha"] != testHead || result["previousStableTag"] != "v0.9.0" || result["body"] != "Changes" || result["title"] != "v0.10.0" {
		t.Fatal(result)
	}
	notesCommand := "gh api --method POST repos/owner/sadoku/releases/generate-notes -f tag_name=v0.10.0 -f target_commitish=" + testHead + " -f previous_tag_name=v0.9.0"
	for _, reply := range []releaseReply{{`{}`, 0}, {`{"body":""}`, 0}, {`{"body":" \n"}`, 0}, {`malformed`, 0}, {"API failed", 1}} {
		commands[notesCommand] = reply
		if _, _, err := runRelease(t, commands, "notes", "--version", "0.10.0", "--output", output); err == nil {
			t.Fatal("accepted invalid notes")
		}
		if readTestFile(t, output) != data {
			t.Fatal("replaced notes on failure")
		}
		entries, err := os.ReadDir(filepath.Dir(output))
		if err != nil || len(entries) != 1 {
			t.Fatal("temporary file leaked", entries, err)
		}
	}
}
