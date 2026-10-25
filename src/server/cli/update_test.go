package cli

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"fmt"
	"testing"
)

func TestUpdateArchiveValidation(t *testing.T) {
	var buffer bytes.Buffer
	gz := gzip.NewWriter(&buffer)
	tr := tar.NewWriter(gz)
	contents := []byte("binary")
	if err := tr.WriteHeader(&tar.Header{Name: "release/sadoku", Mode: 0755, Size: int64(len(contents)), Typeflag: tar.TypeReg}); err != nil {
		t.Fatal(err)
	}
	if _, err := tr.Write(contents); err != nil {
		t.Fatal(err)
	}
	tr.Close()
	gz.Close()
	checksum := fmt.Sprintf("%x", sha256.Sum256(buffer.Bytes()))
	if err := verifyArchive(buffer.Bytes(), []byte(checksum+"\n")); err != nil {
		t.Fatal(err)
	}
	if err := verifyArchive([]byte("changed"), []byte(checksum)); err == nil {
		t.Fatal("accepted corrupted archive")
	}
	b, err := archiveBinary(buffer.Bytes(), "release", "sadoku", false)
	if err != nil || string(b) != "binary" {
		t.Fatal(string(b), err)
	}
	if _, err = archiveBinary(buffer.Bytes(), "other", "sadoku", false); err == nil {
		t.Fatal("accepted missing binary")
	}
	buffer.Reset()
	zw := zip.NewWriter(&buffer)
	file, err := zw.Create("release/sadoku.exe")
	if err != nil {
		t.Fatal(err)
	}
	file.Write(contents)
	zw.Close()
	b, err = archiveBinary(buffer.Bytes(), "release", "sadoku.exe", true)
	if err != nil || string(b) != "binary" {
		t.Fatal(string(b), err)
	}
}
func TestUpdateNeverDowngrades(t *testing.T) {
	for _, test := range []struct {
		channel, current, target string
		newer                    bool
	}{{"stable", "2.0.0", "1.9.9", false}, {"stable", "1.2.3", "1.2.3", false}, {"stable", "1.2.3-rc1", "1.2.3", true}, {"stable", "1.2.3", "1.2.4", true}, {"nightly", "nightly-20261025-1234abcd", "nightly-20261024-1234abcd", false}, {"nightly", "nightly-20261024-1234abcd", "nightly-20261025-1234abcd", true}} {
		if got := updateIsNewer(test.channel, test.current, test.target); got != test.newer {
			t.Fatalf("%+v: got %v", test, got)
		}
	}
}
