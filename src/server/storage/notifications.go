package storage

import (
	"crypto/rand"
	"os"
	"path/filepath"

	"github.com/mukopikmin/sadoku/src/server/config"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

// The filename matches the original TypeScript backend, so changes made by
// another process (including an older installed CLI) reach the same stream.
func (r *Repository) CommentsNotificationSourcePath(source string) (string, error) {
	databasePath := r.Path
	if databasePath == "" {
		var sequence int
		var name string
		if err := r.DB.QueryRow("PRAGMA database_list").Scan(&sequence, &name, &databasePath); err != nil {
			return "", err
		}
	}
	directory := filepath.Join(filepath.Dir(databasePath), "notifications")
	if err := os.MkdirAll(directory, 0700); err != nil {
		return "", err
	}
	return filepath.Join(directory, u.HashSource(source)+".changed"), nil
}

func (r *Repository) CommentsNotificationPath(id int64) (string, error) {
	var source string
	if err := r.DB.QueryRow("SELECT file_path FROM comment_document WHERE id=?", id).Scan(&source); err != nil {
		return "", err
	}
	return r.CommentsNotificationSourcePath(source)
}

func (r *Repository) notifyCommentsChanged(source string) error {
	path, err := r.CommentsNotificationSourcePath(source)
	if err != nil {
		return err
	}
	// Publish only after committing the complete comment transaction. Watching
	// the parent directory also observes this atomic replacement on every OS.
	return config.AtomicWrite(path, []byte(rand.Text()), 0600)
}
