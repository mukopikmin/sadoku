package tooling

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

var archiveVersionPattern = regexp.MustCompile(`^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$`)

func archiveRoot(version, id string) string {
	if version == "nightly" {
		return "sadoku-nightly-" + id
	}
	return "sadoku-v" + version + "-" + id
}
func archive(t target, version, binary, output string) error {
	root := archiveRoot(version, t.ID)
	binaryName := "sadoku"
	if t.OS == "windows" {
		binaryName += ".exe"
	}
	f, err := os.Create(output)
	if err != nil {
		return err
	}
	defer f.Close()
	var tw *tar.Writer
	var zw *zip.Writer
	var gz *gzip.Writer
	if t.OS == "windows" {
		zw = zip.NewWriter(f)
	} else {
		gz = gzip.NewWriter(f)
		tw = tar.NewWriter(gz)
	}
	for _, entry := range []struct {
		name, path string
		mode       int64
	}{{binaryName, binary, 0755}, {"LICENSE", "LICENSE", 0644}, {"THIRD_PARTY_NOTICES.md", "THIRD_PARTY_NOTICES.md", 0644}} {
		data, err := os.ReadFile(entry.path)
		if err != nil {
			return err
		}
		name := root + "/" + entry.name
		var w io.Writer
		if zw != nil {
			h := &zip.FileHeader{Name: name, Method: zip.Deflate}
			h.SetMode(os.FileMode(entry.mode))
			w, err = zw.CreateHeader(h)
		} else {
			err = tw.WriteHeader(&tar.Header{Name: name, Mode: entry.mode, Size: int64(len(data)), Typeflag: tar.TypeReg})
			w = tw
		}
		if err != nil {
			return err
		}
		if _, err = w.Write(data); err != nil {
			return err
		}
	}
	if zw != nil {
		if err = zw.Close(); err != nil {
			return err
		}
	} else {
		if err = tw.Close(); err != nil {
			return err
		}
		if err = gz.Close(); err != nil {
			return err
		}
	}
	return f.Close()
}
func dist(version, binaryVersion string, selected []string) error {
	if version != "nightly" && !archiveVersionPattern.MatchString(version) {
		return fmt.Errorf("invalid archive version: %s", version)
	}
	if binaryVersion == "" {
		binaryVersion = version
	}
	if !binaryVersionPattern.MatchString(binaryVersion) {
		return fmt.Errorf("invalid binary version: %s", binaryVersion)
	}
	chosen := targets
	if len(selected) > 0 {
		chosen = nil
		seen := map[string]bool{}
		for _, id := range selected {
			t, err := findTarget(id)
			if err != nil {
				return err
			}
			if !seen[id] {
				chosen = append(chosen, t)
				seen[id] = true
			}
		}
	}
	if err := os.MkdirAll("dist", 0755); err != nil {
		return err
	}
	if err := generateNotices("THIRD_PARTY_NOTICES.md"); err != nil {
		return err
	}
	var checksums []string
	for _, t := range chosen {
		if err := buildArchive(t, version, binaryVersion, &checksums); err != nil {
			return err
		}
	}
	return atomicWrite("dist/checksums.txt", []byte(strings.Join(checksums, "\n")+"\n"), 0644)
}
func buildArchive(t target, version, binaryVersion string, checksums *[]string) error {
	dir, err := os.MkdirTemp("", "sadoku-release-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	name := "sadoku"
	ext := ".tar.gz"
	if t.OS == "windows" {
		name += ".exe"
		ext = ".zip"
	}
	binary := filepath.Join(dir, name)
	if err = build(binaryVersion, binary, &t); err != nil {
		return err
	}
	if t.OS == runtime.GOOS && t.Arch == runtime.GOARCH {
		if err = verifyNativeBinary(binary); err != nil {
			return err
		}
	}
	output := filepath.Join("dist", archiveRoot(version, t.ID)+ext)
	// Write to a temporary file so failures cannot leave a partially valid archive.
	temp, err := os.CreateTemp("dist", ".archive-*")
	if err != nil {
		return err
	}
	temp.Close()
	defer os.Remove(temp.Name())
	if err = archive(t, version, binary, temp.Name()); err != nil {
		return err
	}
	data, err := os.ReadFile(temp.Name())
	if err != nil {
		return err
	}
	checksum := fmt.Sprintf("%x", sha256.Sum256(data))
	if err = os.Chmod(temp.Name(), 0644); err != nil {
		return err
	}
	if err = os.Rename(temp.Name(), output); err != nil {
		return err
	}
	if err = atomicWrite(output+".sha256", []byte(checksum+"\n"), 0644); err != nil {
		return err
	}
	*checksums = append(*checksums, checksum+"  "+filepath.Base(output))
	fmt.Println("Created", output)
	return nil
}
