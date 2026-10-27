package tooling

import (
	"encoding/json"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestPreviewURL(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX workflow")
	}
	for _, command := range []string{"jq", "bash"} {
		if _, err := exec.LookPath(command); err != nil {
			t.Fatalf("required test command %s: %v", command, err)
		}
	}
	t.Chdir("../..")
	workflow := readTestFile(t, ".github/workflows/cloud_run_preview.yml")
	_, block, ok := strings.Cut(workflow, "      - name: Verify revision readiness and resolve preview URL\n")
	if !ok {
		t.Fatal("missing readiness step")
	}
	_, block, ok = strings.Cut(block, "        run: |\n")
	if !ok {
		t.Fatal("missing shell script")
	}
	block, _, _ = strings.Cut(block, "\n      - name: Create or update preview comment")
	lines := strings.Split(block, "\n")
	for i := range lines {
		lines[i] = strings.TrimPrefix(lines[i], "          ")
	}
	script := strings.Join(lines, "\n")
	for _, tc := range []struct {
		origin, service, region string
		ready, valid            bool
	}{
		{"https://preview.example.com", "revision-proxy", "asia-northeast1", true, true},
		{"https://preview.example.com/", "revision-proxy", "asia-northeast1", true, true},
		{"https://preview.example.com", "revision-proxy", "asia-northeast2", true, true},
		{"", "revision-proxy", "asia-northeast1", true, false},
		{"http://preview.example.com", "revision-proxy", "asia-northeast1", true, false},
		{"https://preview.example.com/path", "revision-proxy", "asia-northeast1", true, false},
		{"https://user@preview.example.com", "revision-proxy", "asia-northeast1", true, false},
		{"https://preview.example.com?q=1", "revision-proxy", "asia-northeast1", true, false},
		{"https://preview.example.com#fragment", "revision-proxy", "asia-northeast1", true, false},
		{"https://preview.example.com", "revision-proxy", "asia-northeast1", false, false},
		{"https://preview.example.com", "", "asia-northeast1", true, false},
		{"https://preview.example.com", "missing-proxy", "asia-northeast1", true, false},
	} {
		t.Run(tc.origin+tc.service+tc.region, func(t *testing.T) {
			dir := t.TempDir()
			writeTestFile(t, filepath.Join(dir, "preview.sh"), script, 0644)
			writeTestFile(t, filepath.Join(dir, "gcloud"), `#!/bin/sh
set -eu
if [ "$1 $2 $3" = 'run services describe' ]; then
 case "$4" in
 revision-proxy)
 [ "$5 $6 $7 $8" = "--project example-project --region $EXPECTED_PROXY_REGION" ]
 cat "$FIXTURES/proxy.json" ;;
 sadoku)
 [ "$5 $6 $7 $8" = '--project example-project --region asia-northeast1' ]
 cat "$FIXTURES/backend.json" ;;
 *) exit 1 ;;
 esac
elif [ "$1 $2 $3 $4" = 'run revisions describe sadoku-revision' ]; then
 [ "$5 $6 $7 $8" = '--project example-project --region asia-northeast1' ]
 cat "$FIXTURES/revision.json"
else
 exit 1
fi
`, 0755)
			origin, _ := json.Marshal(tc.origin)
			writeTestFile(t, filepath.Join(dir, "proxy.json"), `{"spec":{"template":{"spec":{"containers":[{"env":[{"name":"PUBLIC_ORIGIN","value":`+string(origin)+`}]}]}}}}`, 0644)
			writeTestFile(t, filepath.Join(dir, "backend.json"), `{"status":{"traffic":[{"tag":"pr-42","revisionName":"sadoku-revision","url":"https://pr-42---private-backend.run.app"}]}}`, 0644)
			ready := "False"
			if tc.ready {
				ready = "True"
			}
			writeTestFile(t, filepath.Join(dir, "revision.json"), `{"status":{"conditions":[{"type":"Ready","status":"`+ready+`"}]}}`, 0644)
			output, summary := filepath.Join(dir, "output"), filepath.Join(dir, "summary")
			writeTestFile(t, output, "", 0644)
			writeTestFile(t, summary, "", 0644)
			cmd := exec.Command("bash", filepath.Join(dir, "preview.sh"))
			cmd.Env = []string{"PATH=" + dir + ":/usr/bin:/bin", "FIXTURES=" + dir, "PROJECT_ID=example-project", "REGION=asia-northeast1", "SERVICE=sadoku", "PROXY_SERVICE=" + tc.service, "PROXY_REGION=" + tc.region, "EXPECTED_PROXY_REGION=" + tc.region, "PR_NUMBER=42", "PREVIEW_TAG=pr-42", "REVISION=sadoku-revision", "GITHUB_OUTPUT=" + output, "GITHUB_STEP_SUMMARY=" + summary}
			out, err := cmd.CombinedOutput()
			if (err == nil) != tc.valid {
				t.Fatalf("%s: %v", out, err)
			}
			if tc.valid {
				if readTestFile(t, output) != "url=https://preview.example.com/revisions/pr-42/\n" {
					t.Fatal("incorrect URL")
				}
				if strings.Contains(readTestFile(t, summary), "run.app") {
					t.Fatal("published backend URL")
				}
			} else {
				if readTestFile(t, output) != "" || readTestFile(t, summary) != "" {
					t.Fatal("published an invalid link")
				}
			}
		})
	}
}
