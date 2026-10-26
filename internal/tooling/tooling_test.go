package tooling

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
)

func writeTestFile(t *testing.T, path, text string, mode os.FileMode) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(text), mode); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, mode); err != nil {
		t.Fatal(err)
	}
}
func readTestFile(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}
func TestNpmNotices(t *testing.T) {
	t.Chdir("../..")
	notices, err := npmNotices("scripts/testdata/notices/package-lock.json", "scripts/testdata/notices/node_modules")
	if err != nil {
		t.Fatal(err)
	}
	output := renderNotices(append(notices, notices...))
	for _, text := range []string{"example-package", "Apache-2.0"} {
		if !strings.Contains(output, text) {
			t.Fatal(output)
		}
	}
	if strings.Count(output, "| example-package |") != 1 {
		t.Fatal("duplicate notices")
	}
	dir := t.TempDir()
	writeTestFile(t, filepath.Join(dir, "pkg", "package.json"), `{"repository":{"url":"https://example.test/pkg"}}`, 0644)
	writeTestFile(t, filepath.Join(dir, "pkg", "LICENSE"), "License\r\ntext\r\n", 0644)
	lock := filepath.Join(dir, "lock.json")
	writeTestFile(t, lock, `{"packages":{"node_modules/pkg":{"version":"1.0.0","license":"MIT"},"node_modules/ignored":{"version":"1.0.0"}}}`, 0644)
	notices, err = npmNotices(lock, dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(notices) != 1 || notices[0].Source != "https://example.test/pkg" || !strings.Contains(renderNotices(notices), "License\ntext") {
		t.Fatal(notices)
	}
}
func TestArchiveFormats(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	writeTestFile(t, "LICENSE", "project license", 0644)
	writeTestFile(t, "THIRD_PARTY_NOTICES.md", "third party licenses", 0644)
	writeTestFile(t, "binary", "compiled sadoku", 0755)
	for _, target := range targets {
		t.Run(target.ID, func(t *testing.T) {
			path := filepath.Join(dir, target.ID)
			if err := archive(target, "1.2.3", "binary", path); err != nil {
				t.Fatal(err)
			}
			files := map[string]string{}
			modes := map[string]os.FileMode{}
			if target.OS == "windows" {
				z, err := zip.OpenReader(path)
				if err != nil {
					t.Fatal(err)
				}
				defer z.Close()
				for _, f := range z.File {
					r, err := f.Open()
					if err != nil {
						t.Fatal(err)
					}
					data, err := io.ReadAll(r)
					r.Close()
					if err != nil {
						t.Fatal(err)
					}
					files[f.Name] = string(data)
					modes[f.Name] = f.Mode().Perm()
				}
			} else {
				f, err := os.Open(path)
				if err != nil {
					t.Fatal(err)
				}
				defer f.Close()
				gz, err := gzip.NewReader(f)
				if err != nil {
					t.Fatal(err)
				}
				defer gz.Close()
				tr := tar.NewReader(gz)
				for {
					h, err := tr.Next()
					if err == io.EOF {
						break
					}
					if err != nil {
						t.Fatal(err)
					}
					data, err := io.ReadAll(tr)
					if err != nil {
						t.Fatal(err)
					}
					files[h.Name] = string(data)
					modes[h.Name] = os.FileMode(h.Mode)
				}
			}
			name := "sadoku"
			if target.OS == "windows" {
				name += ".exe"
			}
			root := archiveRoot("1.2.3", target.ID) + "/"
			if !reflect.DeepEqual(files, map[string]string{root + name: "compiled sadoku", root + "LICENSE": "project license", root + "THIRD_PARTY_NOTICES.md": "third party licenses"}) {
				t.Fatal(files)
			}
			if modes[root+name] != 0755 {
				t.Fatal(modes)
			}
		})
	}
}
func TestPreviewDocumentAPI(t *testing.T) {
	for _, tc := range []struct {
		name, list, document string
		status               int
		wantError            bool
	}{{"valid", `[{"id":42}]`, `{"markdown":"# Preview"}`, 200, false}, {"empty", `[]`, ``, 200, true}, {"missing-id", `[{}]`, ``, 200, true}, {"http-error", `not JSON`, ``, 404, true}, {"invalid-json", `invalid`, ``, 200, true}} {
		t.Run(tc.name, func(t *testing.T) {
			var paths []string
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				paths = append(paths, r.URL.Path)
				w.WriteHeader(tc.status)
				if r.URL.Path == "/__sadoku/documents" {
					fmt.Fprint(w, tc.list)
				} else {
					fmt.Fprint(w, tc.document)
				}
			}))
			defer server.Close()
			markdown, err := fetchPreviewDocument(server.Client(), server.URL)
			if (err != nil) != tc.wantError {
				t.Fatal(markdown, err)
			}
			if !tc.wantError && (markdown != "# Preview" || !reflect.DeepEqual(paths, []string{"/__sadoku/documents", "/__sadoku/documents/42"})) {
				t.Fatal(markdown, paths)
			}
		})
	}
}
func TestBuildValidation(t *testing.T) {
	for _, args := range [][]string{{"build", "--target", "unknown"}, {"build", "--version", "bad version"}, {"dist", "--version", "../../bad"}, {"dist", "--version", "1.0.0", "--target", "unknown"}, {"install", "--target", "linux-x64"}, {"build", "--unknown"}, {"build", "extra"}} {
		if err := Run(args); err == nil {
			t.Fatal("accepted", args)
		}
	}
}
func TestCloudRunEntrypoint(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX entrypoint")
	}
	t.Chdir("../..")
	for _, tc := range []struct {
		source, port, trust string
		valid               bool
	}{{"", "", "", true}, {"/app/docs/my guide.md", "9090", "", true}, {"", "", "true", true}, {"", "", "yes", false}} {
		t.Run(tc.source+tc.port+tc.trust, func(t *testing.T) {
			dir := t.TempDir()
			writeTestFile(t, filepath.Join(dir, "sadoku"), "#!/bin/sh\nprintf '%s\\n' \"$@\"\n", 0755)
			cmd := exec.Command("sh", "scripts/cloud_run_entrypoint.sh")
			cmd.Env = []string{"PATH=" + dir + ":/usr/bin:/bin", "SADOKU_SOURCE=" + tc.source, "PORT=" + tc.port, "SADOKU_TRUST_FORWARDED_PREFIX=" + tc.trust}
			out, err := cmd.CombinedOutput()
			if (err == nil) != tc.valid {
				t.Fatalf("%s: %v", out, err)
			}
			if !tc.valid {
				return
			}
			source, port := tc.source, tc.port
			if source == "" {
				source = "/app/test/integration/fixtures"
			}
			if port == "" {
				port = "8080"
			}
			expected := []string{"start", source, "--host", "0.0.0.0", "--port", port, "--no-open", "--keep-alive"}
			if tc.trust == "true" {
				expected = append(expected, "--trust-forwarded-prefix")
			}
			if strings.TrimSpace(string(out)) != strings.Join(expected, "\n") {
				t.Fatal(string(out))
			}
		})
	}
}
func TestReleaseInstaller(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX installer")
	}
	t.Chdir("../..")
	installer, err := filepath.Abs("install.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, os, arch, version string
		args                    []string
		corrupt, fail           bool
	}{{"linux", "Linux", "x86_64", "1.2.3", nil, false, false}, {"mac-nightly", "Darwin", "arm64", "nightly", []string{"--nightly"}, false, false}, {"checksum", "Linux", "x86_64", "1.2.3", nil, true, true}, {"unsupported", "Linux", "aarch64", "1.2.3", nil, false, true}, {"bad-argument", "Linux", "x86_64", "1.2.3", []string{"--version"}, false, true}} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			bin := filepath.Join(dir, "bin")
			home := filepath.Join(dir, "home")
			installed := filepath.Join(home, ".local", "bin", "sadoku")
			writeTestFile(t, installed, "existing sadoku\n", 0755)
			writeTestFile(t, filepath.Join(bin, "curl"), `#!/bin/sh
output=""
while [ "$#" -gt 0 ]; do
 case "$1" in
 -o) output="$2"; shift 2 ;;
 -w) printf '%s' 'https://github.com/mukopikmin/sadoku/releases/tag/v1.2.3'; exit 0 ;;
 -*) shift ;;
 *) url="$1"; shift ;;
 esac
done
cp "$FAKE_RELEASE_DIR/${url##*/}" "$output"
`, 0755)
			writeTestFile(t, filepath.Join(bin, "uname"), "#!/bin/sh\ncase \"$1\" in\n-s) echo \"$FAKE_UNAME_S\" ;;\n-m) echo \"$FAKE_UNAME_M\" ;;\nesac\n", 0755)
			id := "linux-x64"
			if tc.os == "Darwin" {
				id = "darwin-arm64"
			}
			root := archiveRoot(tc.version, id)
			path := filepath.Join(dir, root+".tar.gz")
			f, err := os.Create(path)
			if err != nil {
				t.Fatal(err)
			}
			gz := gzip.NewWriter(f)
			tw := tar.NewWriter(gz)
			content := "sadoku " + tc.version + "\n"
			if err = tw.WriteHeader(&tar.Header{Name: root + "/sadoku", Mode: 0755, Size: int64(len(content))}); err != nil {
				t.Fatal(err)
			}
			if _, err = tw.Write([]byte(content)); err != nil {
				t.Fatal(err)
			}
			if err = tw.Close(); err != nil {
				t.Fatal(err)
			}
			if err = gz.Close(); err != nil {
				t.Fatal(err)
			}
			if err = f.Close(); err != nil {
				t.Fatal(err)
			}
			checksum := fmt.Sprintf("%x", sha256.Sum256([]byte(readTestFile(t, path))))
			if tc.corrupt {
				checksum = strings.Repeat("0", 64)
			}
			writeTestFile(t, path+".sha256", checksum+"\n", 0644)
			cmd := exec.Command("sh", append([]string{installer}, tc.args...)...)
			cmd.Env = append(os.Environ(), "HOME="+home, "PATH="+bin+":"+os.Getenv("PATH"), "FAKE_RELEASE_DIR="+dir, "FAKE_UNAME_S="+tc.os, "FAKE_UNAME_M="+tc.arch)
			out, err := cmd.CombinedOutput()
			if (err != nil) != tc.fail {
				t.Fatalf("%s: %v", out, err)
			}
			want := content
			if tc.fail {
				want = "existing sadoku\n"
			}
			if got := readTestFile(t, installed); got != want {
				t.Fatal(got)
			}
			stat, err := os.Stat(installed)
			if err != nil || stat.Mode().Perm() != 0755 {
				t.Fatal(stat, err)
			}
		})
	}
}

func TestSourceInstallPreservesExistingBinary(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Unix source installation")
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "sadoku")
	writeTestFile(t, path, "existing", 0755)
	err := installInto(dir, "1.2.3", func(version, output string) error {
		if version != "1.2.3" {
			t.Fatal(version)
		}
		writeTestFile(t, output, "partial", 0600)
		return fmt.Errorf("build failed")
	})
	if err == nil || readTestFile(t, path) != "existing" {
		t.Fatal("failed build replaced installed binary", err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) != 1 {
		t.Fatal("temporary files leaked", entries, err)
	}
	if err = installInto(dir, "1.2.3", func(_, output string) error { return os.WriteFile(output, []byte("compiled"), 0600) }); err != nil {
		t.Fatal(err)
	}
	if readTestFile(t, path) != "compiled" {
		t.Fatal("binary not installed")
	}
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0755 {
		t.Fatal(info, err)
	}
}

func TestPreviewAnnouncement(t *testing.T) {
	for _, line := range []string{"Preview: http://127.0.0.1:39731/", "[2026-10-26T00:00:00Z] Preview: http://127.0.0.1:39731/"} {
		if got := previewAddress(line); got != "http://127.0.0.1:39731/" {
			t.Fatal(got)
		}
	}
	if got := previewAddress("Serving fixture.md"); got != "" {
		t.Fatal(got)
	}
}
