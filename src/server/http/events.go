package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/mukopikmin/sadoku/src/server/db"
	"github.com/mukopikmin/sadoku/src/server/session"
)

type watchTarget struct {
	path      string
	resources []string
	markdown  bool
}

// Watch parent directories, not file handles: editor saves commonly rename a
// temporary file over the original, and a deleted file can later be recreated.
func (r *router) events(w http.ResponseWriter, req *http.Request, id int64) {
	updates, unsubscribe := r.session.SubscribeInvalidation()
	defer unsubscribe()
	targets := []watchTarget{}
	r.session.Mu.Lock()
	if id != 0 {
		if _, err := r.session.Find(id); err != nil {
			r.session.Mu.Unlock()
			respondError(w, err)
			return
		}
		source := r.session.Sources[id]
		if _, _, remote := session.Source(source); !remote {
			targets = append(targets, watchTarget{path: source, resources: []string{"document", "comments"}, markdown: true})
		}
		identity, _, _ := session.Source(source)
		notification, err := r.session.Repository.CommentsNotificationSourcePath(identity)
		if err != nil {
			r.session.Mu.Unlock()
			respondError(w, err)
			return
		}
		targets = append(targets, watchTarget{path: notification, resources: []string{"comments"}})
	}
	r.session.Mu.Unlock()
	var events <-chan fsnotify.Event
	var watchErrors <-chan error
	if len(targets) > 0 {
		watcher, err := fsnotify.NewWatcher()
		if err != nil {
			respondError(w, err)
			return
		}
		defer watcher.Close()
		parents := map[string]bool{}
		for i := range targets {
			path, err := filepath.Abs(targets[i].path)
			if err != nil {
				respondError(w, err)
				return
			}
			targets[i].path = filepath.Clean(path)
			parent := filepath.Dir(path)
			if !parents[parent] {
				if err = watcher.Add(parent); err != nil {
					respondError(w, err)
					return
				}
				parents[parent] = true
			}
		}
		events, watchErrors = watcher.Events, watcher.Errors
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unavailable.", 500)
		return
	}
	if r.options.OnStreamOpen != nil {
		r.options.OnStreamOpen()
	}
	if r.options.OnStreamClose != nil {
		defer r.options.OnStreamClose()
	}
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(200)
	flusher.Flush()
	send := func(resources []string) error {
		body, _ := json.Marshal(map[string]any{"resources": resources})
		if _, err := fmt.Fprintf(w, "event: invalidate\ndata: %s\n\n", body); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}
	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()
	for {
		select {
		case <-req.Context().Done():
			return
		case <-watchErrors:
			// EventSource reconnects with fresh watchers after an OS watch failure.
			return
		case event, ok := <-events:
			if !ok {
				return
			}
			for _, target := range targets {
				same := filepath.Clean(event.Name) == target.path
				if runtime.GOOS == "windows" {
					same = strings.EqualFold(filepath.Clean(event.Name), target.path)
				}
				if !same {
					continue
				}
				if target.markdown {
					message := "Reloading preview after Markdown change: " + target.path
					if r.options.Log != nil {
						r.options.Log(message)
					} else {
						fmt.Printf("[%s] %s\n", db.Now(), message)
					}
				}
				if err := send(target.resources); err != nil {
					return
				}
			}
		case <-updates:
			if err := send([]string{"document", "comments"}); err != nil {
				return
			}
		case <-heartbeat.C:
			if _, err := fmt.Fprint(w, ": keep-alive\n\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}
