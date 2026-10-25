package session

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestRemoteIdentityStripsQueryAndFragment(t *testing.T) {
	identity, fetch, remote := Source("https://example.com/docs.md?token=private#heading")
	if !remote || identity != "https://example.com/docs.md" || fetch != "https://example.com/docs.md?token=private#heading" {
		t.Fatal(identity, fetch, remote)
	}
}
func TestLocalDestinationRejectsTraversalAndSymlinks(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	if err := SafeLocal(root, filepath.Join(root, "..", "outside.md"), true); err == nil {
		t.Fatal("accepted traversal")
	}
	if err := SafeLocal(root, filepath.Join(root, "new.md"), true); err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS == "windows" {
		t.Skip("symlink creation requires Windows privileges")
	}
	if err := os.Symlink(outside, filepath.Join(root, "linked")); err != nil {
		t.Fatal(err)
	}
	if err := SafeLocal(root, filepath.Join(root, "linked", "new.md"), true); err == nil {
		t.Fatal("accepted linked directory")
	}
	file := filepath.Join(outside, "file.md")
	if err := os.WriteFile(file, []byte("outside"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(file, filepath.Join(root, "file.md")); err != nil {
		t.Fatal(err)
	}
	if err := SafeLocal(root, filepath.Join(root, "file.md"), true); err == nil {
		t.Fatal("accepted linked file")
	}
	// A selected root may itself resolve through a platform-provided alias.
	alias := filepath.Join(t.TempDir(), "root")
	if err := os.Symlink(root, alias); err != nil {
		t.Fatal(err)
	}
	destination, err := ResolveLocal(alias, filepath.Join(alias, "safe.md"), true)
	realRoot, _ := filepath.EvalSymlinks(root)
	if err != nil || destination != filepath.Join(realRoot, "safe.md") {
		t.Fatal(destination, err)
	}
}
