package http_test

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/mukopikmin/sadoku/src/server/cli"
	"github.com/mukopikmin/sadoku/src/server/config"
)

type streamEvent struct {
	resources []string
	err       error
}

func eventStream(t *testing.T, serverURL, path string) (<-chan streamEvent, func()) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	req, err := http.NewRequestWithContext(ctx, "GET", serverURL+path, nil)
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	if response.StatusCode != 200 {
		response.Body.Close()
		cancel()
		t.Fatalf("event stream status: %d", response.StatusCode)
	}
	events := make(chan streamEvent, 32)
	done := make(chan struct{})
	go func() {
		defer close(done)
		scanner := bufio.NewScanner(response.Body)
		for scanner.Scan() {
			data, ok := strings.CutPrefix(scanner.Text(), "data: ")
			if !ok {
				continue
			}
			var event struct {
				Resources []string `json:"resources"`
			}
			err := json.Unmarshal([]byte(data), &event)
			select {
			case events <- streamEvent{event.Resources, err}:
			case <-ctx.Done():
				return
			}
		}
		if err := scanner.Err(); err != nil && ctx.Err() == nil {
			select {
			case events <- streamEvent{err: err}:
			case <-ctx.Done():
			}
		}
	}()
	closeStream := func() {
		cancel()
		response.Body.Close()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Error("event reader did not stop")
		}
	}
	t.Cleanup(closeStream)
	return events, closeStream
}
func expectEvent(t *testing.T, events <-chan streamEvent, want ...string) {
	t.Helper()
	select {
	case event := <-events:
		if event.err != nil || !reflect.DeepEqual(event.resources, want) {
			t.Fatalf("invalidation: %v %v; want %v", event.resources, event.err, want)
		}
	case <-time.After(5 * time.Second):
		t.Fatalf("missing invalidation for %v", want)
	}
}
func expectNoEvent(t *testing.T, events <-chan streamEvent) {
	t.Helper()
	select {
	case event := <-events:
		t.Fatalf("unexpected invalidation: %+v", event)
	case <-time.After(250 * time.Millisecond):
	}
}
func settleEvents(t *testing.T, events <-chan streamEvent) {
	t.Helper()
	timer := time.NewTimer(100 * time.Millisecond)
	defer timer.Stop()
	for {
		select {
		case event := <-events:
			if event.err != nil {
				t.Fatal(event.err)
			}
			timer.Reset(100 * time.Millisecond)
		case <-timer.C:
			return
		}
	}
}

func TestSSEWatchesAtomicSavesAndRecreatedFiles(t *testing.T) {
	_, server, file := setup(t)
	events, _ := eventStream(t, server.URL, "/__sadoku/documents/1/events")
	operations := []struct {
		name string
		run  func() error
	}{
		{"write preserving size and modification time", func() error {
			info, err := os.Stat(file)
			if err != nil {
				return err
			}
			before, err := os.ReadFile(file)
			if err != nil {
				return err
			}
			after := bytes.Repeat([]byte("x"), len(before))
			if err = os.WriteFile(file, after, 0600); err != nil {
				return err
			}
			return os.Chtimes(file, info.ModTime(), info.ModTime())
		}},
		{"atomic replacement", func() error { return config.AtomicWrite(file, []byte("replaced\n"), 0600) }},
		{"edit after replacement", func() error { return os.WriteFile(file, []byte("edited\n"), 0600) }},
		{"delete", func() error { return os.Remove(file) }},
		{"recreate", func() error { return os.WriteFile(file, []byte("recreated\n"), 0600) }},
		{"edit after recreation", func() error { return os.WriteFile(file, []byte("edited again\n"), 0600) }},
	}
	for _, op := range operations {
		t.Run(op.name, func(t *testing.T) {
			if err := op.run(); err != nil {
				t.Fatal(err)
			}
			expectEvent(t, events, "document", "comments")
			settleEvents(t, events)
		})
	}
}
func TestSSEIgnoresUnrelatedFilesAndReadAccess(t *testing.T) {
	_, server, file := setup(t)
	events, _ := eventStream(t, server.URL, "/__sadoku/documents/1/events")
	if _, err := os.ReadFile(file); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(filepath.Dir(file), "unrelated.md"), []byte("changed"), 0600); err != nil {
		t.Fatal(err)
	}
	expectNoEvent(t, events)
}

// Run the real CLI in another process to ensure events do not depend on any
// in-memory state or on repeatedly querying SQLite from the HTTP server.
func TestCommentNotificationWriterProcess(t *testing.T) {
	source := os.Getenv("SADOKU_TEST_NOTIFICATION_SOURCE")
	if source == "" {
		return
	}
	if err := cli.Execute(context.Background(), []string{"comment", "add", "--source", source, "--start-line", "1", "--body", "from another process"}, os.Stdout, nil); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	os.Exit(0)
}
func TestSSECommentsFromAnotherCLIProcessAreScoped(t *testing.T) {
	s, server, file := setup(t)
	events, _ := eventStream(t, server.URL, "/__sadoku/documents/1/events")
	other, err := s.Repository.Ensure(filepath.Join(filepath.Dir(file), "other.md"))
	if err != nil {
		t.Fatal(err)
	}
	comments, err := s.Repository.ReadComments(other.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err = s.Repository.SaveComments(other.ID, comments); err != nil {
		t.Fatal(err)
	}
	expectNoEvent(t, events)
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, executable, "-test.run=^TestCommentNotificationWriterProcess$")
	command.Env = append(os.Environ(), "SADOKU_TEST_NOTIFICATION_SOURCE="+file)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("CLI: %v\n%s", err, output)
	}
	expectEvent(t, events, "comments")
	saved, err := s.Repository.ReadComments(1)
	if err != nil || len(saved.Comments) != 1 || saved.Comments[0].Body != "from another process" {
		t.Fatalf("committed comments: %+v %v", saved, err)
	}
}
func TestSSESessionRefreshReachesAllSubscribers(t *testing.T) {
	s, server, _ := setup(t)
	global, closeGlobal := eventStream(t, server.URL, "/__sadoku/events")
	document, _ := eventStream(t, server.URL, "/__sadoku/documents/1/events")
	s.Invalidate()
	expectEvent(t, global, "document", "comments")
	expectEvent(t, document, "document", "comments")
	closeGlobal()
	s.Invalidate()
	expectEvent(t, document, "document", "comments")
}
