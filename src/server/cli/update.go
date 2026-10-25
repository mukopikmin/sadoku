package cli

import (
	"archive/tar"
	"archive/zip"
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/mukopikmin/sadoku/src/server/config"
)

func download(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "sadoku-update")
	client := &http.Client{Timeout: 2 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 256<<20))
}
func verifyArchive(archive, checksum []byte) error {
	expected := strings.TrimSpace(string(checksum))
	if !regexp.MustCompile(`^[0-9a-fA-F]{64}$`).MatchString(expected) {
		return fmt.Errorf("release checksum is not a 64-digit hexadecimal SHA-256 value")
	}
	actual := sha256.Sum256(archive)
	if !strings.EqualFold(expected, hex.EncodeToString(actual[:])) {
		return fmt.Errorf("release checksum does not match")
	}
	return nil
}
func archiveBinary(archive []byte, root, binary string, isZip bool) ([]byte, error) {
	if isZip {
		reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
		if err != nil {
			return nil, err
		}
		for _, file := range reader.File {
			if file.Name == root+"/"+binary && !file.Mode().IsRegular() {
				return nil, fmt.Errorf("release binary is not a regular file")
			}
			if file.Name == root+"/"+binary {
				f, err := file.Open()
				if err != nil {
					return nil, err
				}
				defer f.Close()
				return io.ReadAll(io.LimitReader(f, 256<<20))
			}
		}
	} else {
		reader, err := gzip.NewReader(bytes.NewReader(archive))
		if err != nil {
			return nil, err
		}
		defer reader.Close()
		tr := tar.NewReader(reader)
		for {
			header, err := tr.Next()
			if err == io.EOF {
				break
			}
			if err != nil {
				return nil, err
			}
			if strings.TrimPrefix(header.Name, "./") == root+"/"+binary {
				if header.Typeflag != tar.TypeReg {
					return nil, fmt.Errorf("release binary is not a regular file")
				}
				return io.ReadAll(io.LimitReader(tr, 256<<20))
			}
		}
	}
	return nil, fmt.Errorf("release archive is missing the binary")
}
func Update(ctx context.Context, channel string, out io.Writer) error {
	if channel == "" {
		channel = "stable"
		if strings.HasPrefix(Version, "nightly-") {
			channel = "nightly"
		}
	}
	if channel != "stable" && channel != "nightly" {
		return fmt.Errorf("invalid update channel")
	}
	target := ""
	switch runtime.GOOS + "/" + runtime.GOARCH {
	case "linux/amd64":
		target = "linux-x64"
	case "darwin/arm64":
		target = "darwin-arm64"
	case "windows/amd64":
		target = "windows-x64"
	default:
		return fmt.Errorf("self-update is unsupported on this platform")
	}
	api := "https://api.github.com/repos/mukopikmin/sadoku"
	version, tag := "", ""
	if channel == "stable" {
		b, err := download(ctx, api+"/releases/latest")
		if err != nil {
			return err
		}
		var release struct {
			Tag string `json:"tag_name"`
		}
		if err = json.Unmarshal(b, &release); err != nil {
			return err
		}
		if !regexp.MustCompile(`^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$`).MatchString(release.Tag) {
			return fmt.Errorf("invalid release tag")
		}
		tag = release.Tag
		version = strings.TrimPrefix(tag, "v")
	} else {
		b, err := download(ctx, api+"/git/ref/tags/nightly")
		if err != nil {
			return err
		}
		var ref struct{ Object struct{ SHA string } }
		if err = json.Unmarshal(b, &ref); err != nil {
			return err
		}
		if !regexp.MustCompile(`^[0-9a-f]{40}$`).MatchString(ref.Object.SHA) {
			return fmt.Errorf("invalid nightly commit")
		}
		b, err = download(ctx, api+"/commits/"+ref.Object.SHA)
		if err != nil {
			return err
		}
		var commit struct {
			Commit struct{ Committer struct{ Date time.Time } }
		}
		if err = json.Unmarshal(b, &commit); err != nil {
			return err
		}
		if commit.Commit.Committer.Date.IsZero() {
			return fmt.Errorf("invalid nightly commit date")
		}
		version = "nightly-" + commit.Commit.Committer.Date.UTC().Format("20060102") + "-" + ref.Object.SHA[:8]
		tag = "nightly"
	}
	fmt.Fprintf(out, "Current version: %s\nUpdate channel: %s\nAvailable version: %s\n", Version, channel, version)
	if !updateIsNewer(channel, Version, version) {
		fmt.Fprintln(out, "No newer version available: "+version)
		return nil
	}
	fmt.Fprintf(out, "Update Sadoku to %s? [y/N] ", version)
	answer, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && len(answer) == 0 {
		return err
	}
	if a := strings.ToLower(strings.TrimSpace(answer)); a != "y" && a != "yes" {
		fmt.Fprintln(out, "Update cancelled.")
		return nil
	}
	root := "sadoku-v" + version + "-" + target
	if channel == "nightly" {
		root = "sadoku-nightly-" + target
	}
	extension, binary := ".tar.gz", "sadoku"
	if runtime.GOOS == "windows" {
		extension = ".zip"
		binary = "sadoku.exe"
	}
	archiveName := root + extension
	base := "https://github.com/mukopikmin/sadoku/releases/download/" + tag + "/"
	archive, err := download(ctx, base+archiveName)
	if err != nil {
		return err
	}
	checksum, err := download(ctx, base+archiveName+".sha256")
	if err != nil {
		return err
	}
	if err = verifyArchive(archive, checksum); err != nil {
		return err
	}
	contents, err := archiveBinary(archive, root, binary, runtime.GOOS == "windows")
	if err != nil {
		return err
	}
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	executable, err = filepath.EvalSymlinks(executable)
	if err != nil {
		return err
	}
	temporary, err := os.CreateTemp(filepath.Dir(executable), ".sadoku-update-*")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	if runtime.GOOS == "windows" {
		temporaryPath += ".exe"
		temporary.Close()
		os.Remove(temporary.Name())
		temporary, err = os.OpenFile(temporaryPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0700)
		if err != nil {
			return err
		}
	}
	defer os.Remove(temporaryPath)
	if err = temporary.Chmod(0755); err == nil {
		_, err = temporary.Write(contents)
	}
	closeErr := temporary.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	probe, err := exec.CommandContext(ctx, temporaryPath, "--version").Output()
	if err != nil || strings.TrimSpace(string(probe)) != "sadoku "+version {
		return fmt.Errorf("downloaded binary version does not match %s", version)
	}
	if runtime.GOOS == "windows" {
		backup := executable + ".old"
		os.Remove(backup)
		if err = os.Rename(executable, backup); err != nil {
			return err
		}
		if err = config.AtomicWrite(executable, contents, 0755); err != nil {
			os.Rename(backup, executable)
			return err
		}
	} else {
		if err = config.AtomicWrite(executable, contents, 0755); err != nil {
			return err
		}
	}
	fmt.Fprintln(out, "Updated to: "+version)
	return nil
}

func updateIsNewer(channel, current, target string) bool {
	if current == target {
		return false
	}
	if channel == "nightly" {
		pattern := regexp.MustCompile(`^nightly-(\d{8})-[0-9a-f]+$`)
		c, t := pattern.FindStringSubmatch(current), pattern.FindStringSubmatch(target)
		if c != nil && t != nil && c[1] != t[1] {
			return t[1] > c[1]
		}
		return true
	}
	pattern := regexp.MustCompile(`^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$`)
	c, t := pattern.FindStringSubmatch(current), pattern.FindStringSubmatch(target)
	if c == nil || t == nil {
		return true
	}
	for i := 1; i <= 3; i++ {
		a, _ := strconv.ParseUint(c[i], 10, 64)
		b, _ := strconv.ParseUint(t[i], 10, 64)
		if a != b {
			return b > a
		}
	}
	return strings.Contains(current, "-") && !strings.Contains(target, "-")
}
