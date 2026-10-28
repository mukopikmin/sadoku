package server

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"connectrpc.com/connect"
	pb "github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1"
	"github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1/previewv1connect"
	"github.com/mukopikmin/sadoku/src/server/cli"
	"github.com/mukopikmin/sadoku/src/server/config"
	"github.com/mukopikmin/sadoku/src/server/db"
	"github.com/mukopikmin/sadoku/src/server/session"
	"github.com/mukopikmin/sadoku/src/server/storage"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

func startAsyncTest(t *testing.T, start func(context.Context, io.Writer) error) (string, func()) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	output := &previewOutput{ready: make(chan string, 1)}
	done := make(chan error, 1)
	go func() { done <- start(ctx, output) }()
	stopped := false
	stop := func() {
		if stopped {
			return
		}
		stopped = true
		cancel()
		select {
		case err := <-done:
			if err != nil {
				t.Errorf("server: %v", err)
			}
		case <-time.After(10 * time.Second):
			t.Error("server did not stop with preparation in progress")
		}
	}
	t.Cleanup(stop)
	select {
	case url := <-output.ready:
		return strings.TrimSuffix(url, "/"), stop
	case err := <-done:
		stopped = true
		cancel()
		t.Fatalf("server startup: %v", err)
	case <-time.After(10 * time.Second):
		t.Fatal("server waited for background preparation")
	}
	return "", stop
}
func awaitSignal(t *testing.T, signal <-chan struct{}) {
	t.Helper()
	select {
	case <-signal:
	case <-time.After(10 * time.Second):
		t.Fatal("background operation did not start")
	}
}
func assertShell(t *testing.T, url string) {
	t.Helper()
	client := &http.Client{Timeout: 3 * time.Second}
	response, err := client.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		t.Fatalf("shell status: %d", response.StatusCode)
	}
}
func TestServerStartsBeforeRemoteSnapshotFetchAndCancelsIt(t *testing.T) {
	root := t.TempDir()
	t.Setenv("SADOKU_COMMENTS_DIR", filepath.Join(root, "comments"))
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(root, "config"))
	t.Setenv("APPDATA", "")
	started, cancelled := make(chan struct{}), make(chan struct{})
	remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { close(started); <-r.Context().Done(); close(cancelled) }))
	t.Cleanup(remote.Close)
	url, stop := startAsyncTest(t, func(ctx context.Context, out io.Writer) error {
		return Start(ctx, cli.StartOptions{Source: remote.URL + "/slow.md", Host: "127.0.0.1", KeepAlive: true}, out)
	})
	awaitSignal(t, started)
	// Neither the shell nor metadata requires the stalled remote body.
	assertShell(t, url)
	base := strings.Split(url, "/documents/")[0]
	client := previewv1connect.NewPreviewServiceClient(http.DefaultClient, base, connect.WithProtoJSON())
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	docs, err := client.ListDocuments(ctx, connect.NewRequest(&pb.ListDocumentsRequest{}))
	if err != nil || len(docs.Msg.Documents) != 1 {
		t.Fatalf("metadata while fetching: %+v %v", docs, err)
	}
	if _, err = client.GetSession(ctx, connect.NewRequest(&pb.GetSessionRequest{})); err != nil {
		t.Fatal(err)
	}
	_, err = client.GetDirectoryStatus(ctx, connect.NewRequest(&pb.GetDirectoryStatusRequest{}))
	if connect.CodeOf(err) != connect.CodeUnimplemented {
		t.Fatalf("single-source directory status: %v", err)
	}
	stop()
	awaitSignal(t, cancelled)
}

type gatedDirectoryRepository struct {
	u.Repository
	registrationStarted, register, listed, publish chan struct{}
	fail                                           error
	statisticsStarted, statisticsRelease           chan struct{}
}

func (r *gatedDirectoryRepository) Statistics() (any, error) {
	if r.statisticsStarted != nil {
		close(r.statisticsStarted)
		<-r.statisticsRelease
	}
	return r.Repository.Statistics()
}
func (r *gatedDirectoryRepository) EnsureMany(ctx context.Context, paths []string) ([]u.Document, error) {
	close(r.registrationStarted)
	select {
	case <-r.register:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	if r.fail != nil {
		return nil, r.fail
	}
	return r.Repository.EnsureMany(ctx, paths)
}
func (r *gatedDirectoryRepository) DocumentsContext(ctx context.Context) ([]u.Document, error) {
	close(r.listed)
	select {
	case <-r.publish:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	return r.Repository.DocumentsContext(ctx)
}
func TestDirectoryPreparationServesProgressReadyErrorsAndCancellation(t *testing.T) {
	for _, outcome := range []string{"ready", "error", "cancelled"} {
		t.Run(outcome, func(t *testing.T) {
			root := t.TempDir()
			docs := filepath.Join(root, "docs")
			if err := os.Mkdir(docs, 0700); err != nil {
				t.Fatal(err)
			}
			for _, name := range []string{"a.md", "b.md"} {
				if err := os.WriteFile(filepath.Join(docs, name), []byte("# Test\n"), 0600); err != nil {
					t.Fatal(err)
				}
			}
			t.Setenv("XDG_CONFIG_HOME", filepath.Join(root, "config"))
			t.Setenv("APPDATA", "")
			path := filepath.Join(root, "comments", "sadoku.sqlite3")
			database, err := db.Open(path)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { database.Close() })
			repo := &gatedDirectoryRepository{Repository: &storage.Repository{DB: database, Path: path}, registrationStarted: make(chan struct{}), register: make(chan struct{}), listed: make(chan struct{}), publish: make(chan struct{})}
			if outcome == "error" {
				repo.fail = errors.New("registration failed")
			}
			s, err := session.New(context.Background(), docs, repo, config.Defaults())
			if err != nil {
				t.Fatal(err)
			}
			snapshotStarted, snapshotCancelled := make(chan struct{}), make(chan struct{})
			s.ReadRemote = func(ctx context.Context, source string) (string, error) {
				close(snapshotStarted)
				<-ctx.Done()
				close(snapshotCancelled)
				return "", ctx.Err()
			}
			url, stop := startAsyncTest(t, func(ctx context.Context, out io.Writer) error {
				return startSession(ctx, cli.StartOptions{Source: docs, Host: "127.0.0.1", KeepAlive: true}, out, s, config.Defaults())
			})
			awaitSignal(t, repo.registrationStarted)
			client := previewv1connect.NewPreviewServiceClient(&http.Client{Timeout: 3 * time.Second}, url, connect.WithProtoJSON())
			status := func() *pb.GetDirectoryStatusResponse {
				t.Helper()
				result, err := client.GetDirectoryStatus(context.Background(), connect.NewRequest(&pb.GetDirectoryStatusRequest{}))
				if err != nil {
					t.Fatal(err)
				}
				return result.Msg
			}

			statisticsDone := make(chan error, 1)
			var releaseStatistics func()
			if outcome == "ready" {
				// Simulate a slow independent query while directory work is blocked.
				// Progress RPCs must remain available even though this RPC has not returned.
				repo.statisticsStarted = make(chan struct{})
				repo.statisticsRelease = make(chan struct{})
				var releaseOnce sync.Once
				releaseStatistics = func() { releaseOnce.Do(func() { close(repo.statisticsRelease) }) }
				t.Cleanup(releaseStatistics)
				go func() {
					_, err := client.GetStatistics(context.Background(), connect.NewRequest(&pb.GetStatisticsRequest{}))
					statisticsDone <- err
				}()
				awaitSignal(t, repo.statisticsStarted)
			}
			loading := status()
			if loading.State != "loading" || loading.Detected != 2 || loading.Registered != 0 {
				t.Fatalf("initial progress: %+v", loading)
			}
			assertShell(t, url)
			list, err := client.ListDocuments(context.Background(), connect.NewRequest(&pb.ListDocumentsRequest{}))
			if err != nil || len(list.Msg.Documents) != 0 {
				t.Fatalf("partial list published: %v %v", list, err)
			}
			_, err = client.CreateDocument(context.Background(), connect.NewRequest(&pb.CreateDocumentRequest{Filename: "early.md"}))
			if connect.CodeOf(err) != connect.CodeFailedPrecondition {
				t.Fatalf("creation during loading: %v", err)
			}
			if outcome == "cancelled" {
				stop()
				result, err := s.Invoke(context.Background(), "GetDirectoryStatus", session.Input{})
				if err != nil {
					t.Fatal(err)
				}
				got := result.(session.DirectoryStatus)
				if got.State != "error" || got.Error == nil || got.Error.Name != "AbortError" {
					t.Fatalf("cancellation: %+v", got)
				}
				return
			}
			close(repo.register)
			if outcome == "ready" {
				awaitSignal(t, repo.listed)
				registered := status()
				if registered.State != "loading" || registered.Registered != 2 {
					t.Fatalf("registration progress: %+v", registered)
				}
				close(repo.publish)
				awaitSignal(t, snapshotStarted)
				ready := status()
				if ready.State != "ready" || ready.Detected != 2 || ready.Registered != 2 {
					t.Fatalf("ready before snapshots: %+v", ready)
				}
				list, err = client.ListDocuments(context.Background(), connect.NewRequest(&pb.ListDocumentsRequest{}))
				if err != nil || len(list.Msg.Documents) != 2 {
					t.Fatalf("ready list: %v %v", list, err)
				}

				releaseStatistics()
				if err := <-statisticsDone; err != nil {
					t.Fatal(err)
				}
				stop()
				awaitSignal(t, snapshotCancelled)
			} else {
				deadline := time.Now().Add(5 * time.Second)
				for {
					got := status()
					if got.State == "error" {
						if got.Error == nil || got.Error.Name != "Error" || got.Error.Message != "registration failed" || got.Registered != 0 {
							t.Fatalf("failure status: %+v", got)
						}
						break
					}
					if time.Now().After(deadline) {
						t.Fatal("preparation did not publish error")
					}
					time.Sleep(5 * time.Millisecond)
				}
				assertShell(t, url)
				stop()
			}
		})
	}
}
