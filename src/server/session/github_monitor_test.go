package session

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/synctest"
	"time"

	"github.com/mukopikmin/sadoku/src/server/config"
)

func TestGitHubMonitorKeepsUnchangedHeadsAndRecoversAfterErrors(t *testing.T) {
	f := newGitHubFixture(t)
	updates, unsubscribe := f.s.SubscribeInvalidation()
	defer unsubscribe()
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		stopped := make(chan struct{})
		var failures []error
		go func() {
			defer close(stopped)
			f.s.Monitor(ctx, config.Defaults(), func(err error) { failures = append(failures, err) })
		}()
		synctest.Wait()
		time.Sleep(30 * time.Second)
		synctest.Wait()
		select {
		case <-updates:
			t.Fatal("unchanged head invalidated the session")
		default:
		}
		original := f.responses[f.endpoint]
		f.responses[f.endpoint] = "invalid response"
		f.write(t)
		time.Sleep(30 * time.Second)
		synctest.Wait()
		if len(failures) != 1 {
			t.Fatalf("monitor errors: %v", failures)
		}
		f.responses[f.endpoint] = original
		sha := strings.Repeat("b", 40)
		original.(map[string]any)["head"] = map[string]any{"sha": sha}
		f.responses[f.endpoint+"/files?per_page=100&page=1"] = []any{map[string]any{"filename": "added.md", "status": "added"}}
		f.write(t)
		time.Sleep(30 * time.Second)
		synctest.Wait()
		select {
		case <-updates:
		default:
			t.Fatal("new head did not invalidate the session")
		}
		f.s.Mu.Lock()
		if f.s.GitHub.HeadSHA != sha || len(f.s.Documents) != 1 || f.s.Documents[0].RelativePath != "added.md" || !strings.HasSuffix(f.s.Sources[f.s.Documents[0].ID], "?ref="+sha) {
			t.Errorf("refreshed session: %+v %+v", f.s.GitHub, f.s.Documents)
		}
		f.s.Mu.Unlock()
		time.Sleep(30 * time.Second)
		synctest.Wait()
		select {
		case <-updates:
			t.Fatal("unchanged refreshed head invalidated again")
		default:
		}
		cancel()
		<-stopped
	})
	data, err := os.ReadFile(filepath.Join(f.directory, "calls.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	fileRequests := 0
	for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		var call struct{ Endpoint string }
		if err := json.Unmarshal([]byte(line), &call); err != nil {
			t.Fatal(err)
		}
		if strings.Contains(call.Endpoint, "/files?") {
			fileRequests++
		}
	}
	if fileRequests != 2 {
		t.Fatalf("unchanged head unnecessarily fetched files: %d", fileRequests)
	}
}
