package session

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

func createLocalDocument(root, directory, filename string) (err error) {
	defer func() {
		if errors.Is(err, os.ErrPermission) {
			err = u.Fail("failed_precondition", "The destination directory is not writable.")
		}
	}()
	parent, err := filepath.EvalSymlinks(root)
	if err != nil {
		return err
	}
	for _, part := range strings.Split(directory, "/") {
		if part == "" {
			continue
		}
		parent = filepath.Join(parent, part)
		info, err := os.Lstat(parent)
		if errors.Is(err, os.ErrNotExist) {
			return u.Fail("invalid_argument", "The destination directory no longer exists.")
		}
		if err != nil {
			return err
		}
		if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return u.Fail("invalid_argument", "Choose an existing directory without symbolic links.")
		}
	}
	destination := filepath.Join(parent, filename)
	// Existing folders and symbolic links count as name conflicts too.
	if _, err := os.Lstat(destination); err == nil {
		return u.Fail("already_exists", "A file or folder with this name already exists.")
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	file, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if errors.Is(err, os.ErrExist) {
		return u.Fail("already_exists", "A file or folder with this name already exists.")
	}
	if err != nil {
		return err
	}
	return file.Close()
}
