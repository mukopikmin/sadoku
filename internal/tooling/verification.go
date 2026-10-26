package tooling

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

func fetchJSON(client *http.Client, address string, v any) error {
	response, err := client.Get(address)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("request %s failed with %d", address, response.StatusCode)
	}
	return json.NewDecoder(response.Body).Decode(v)
}
func fetchPreviewDocument(client *http.Client, base string) (string, error) {
	var documents []struct {
		ID *int `json:"id"`
	}
	if err := fetchJSON(client, base+"/__sadoku/documents", &documents); err != nil {
		return "", err
	}
	if len(documents) == 0 || documents[0].ID == nil {
		return "", fmt.Errorf("preview document list was empty")
	}
	var document struct {
		Markdown string `json:"markdown"`
	}
	err := fetchJSON(client, fmt.Sprintf("%s/__sadoku/documents/%d", base, *documents[0].ID), &document)
	return document.Markdown, err
}
func verifyNativeBinary(binary string) error {
	dir, err := os.MkdirTemp("", "sadoku-verification-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	fixture := dir + "/fixture.md"
	if err = os.WriteFile(fixture, []byte("```mermaid\ngraph TD\n  A --> B\n```\n"), 0644); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, binary, "start", fixture, "--host", "127.0.0.1", "--port", "39731", "--no-open", "--keep-alive")
	cmd.Env = append(os.Environ(), "HOME="+dir, "XDG_CONFIG_HOME="+dir, "XDG_DATA_HOME="+dir, "SADOKU_COMMENTS_DIR="+dir)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	// Write stderr to a file to avoid blocking the child and avoid races when reading diagnostics.
	stderr, err := os.CreateTemp(dir, "stderr-*")
	if err != nil {
		return err
	}
	defer stderr.Close()
	cmd.Stderr = stderr
	if err = cmd.Start(); err != nil {
		return err
	}
	defer func() { _ = cmd.Process.Kill(); _ = cmd.Wait() }()
	addresses := make(chan string, 1)
	go func() {
		scanner := bufio.NewScanner(stdout)
		sent := false
		for scanner.Scan() {
			if address := previewAddress(scanner.Text()); !sent && address != "" {
				addresses <- address
				sent = true
			}
		}
		if !sent {
			addresses <- ""
		}
	}()
	timer := time.NewTimer(5 * time.Second)
	defer timer.Stop()
	var address string
	select {
	case address = <-addresses:
	case <-timer.C:
		return fmt.Errorf("timed out waiting for preview URL")
	}
	if address == "" {
		data, _ := os.ReadFile(stderr.Name())
		return fmt.Errorf("preview exited before reporting a URL: %s", data)
	}
	parsed, err := url.Parse(address)
	if err != nil {
		return err
	}
	base := parsed.Scheme + "://" + parsed.Host
	client := &http.Client{Timeout: 5 * time.Second}
	response, err := client.Get(address)
	if err != nil {
		return err
	}
	html, err := io.ReadAll(response.Body)
	response.Body.Close()
	if err != nil {
		return err
	}
	if response.StatusCode != 200 || !regexp.MustCompile(`<script type="module" src="[^"]+-[\w-]{8}\.js"`).Match(html) {
		return fmt.Errorf("preview page did not include the preview client")
	}
	markdown, err := fetchPreviewDocument(client, base)
	if err != nil {
		return err
	}
	if !strings.Contains(markdown, "```mermaid") {
		return fmt.Errorf("preview document API did not return the Mermaid block")
	}
	var manifest map[string]struct {
		File                    string
		Imports, DynamicImports []string
	}
	if err = fetchJSON(client, base+"/assets/.vite/manifest.json", &manifest); err != nil {
		return err
	}
	pending := []string{"node_modules/mermaid/dist/mermaid.core.mjs"}
	seen := map[string]bool{}
	for len(pending) > 0 {
		key := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		if seen[key] {
			continue
		}
		seen[key] = true
		entry, ok := manifest[key]
		if !ok || entry.File == "" {
			return fmt.Errorf("Mermaid dependency was missing: %s", key)
		}
		pending = append(pending, entry.Imports...)
		pending = append(pending, entry.DynamicImports...)
		response, err := client.Get(base + "/assets/" + entry.File)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(io.Discard, response.Body)
		response.Body.Close()
		if copyErr != nil {
			return copyErr
		}
		if response.StatusCode != 200 {
			return fmt.Errorf("Mermaid asset request failed with %d", response.StatusCode)
		}
	}
	if len(seen) <= 1 {
		return fmt.Errorf("bundled Mermaid assets were missing from the manifest")
	}
	fmt.Println("Verified native binary and bundled Mermaid asset graph.")
	return nil
}

// The server prefixes preview announcements with a timestamp.
var previewURLPattern = regexp.MustCompile(`Preview: (http://[^\s]+)`)

func previewAddress(line string) string {
	match := previewURLPattern.FindStringSubmatch(line)
	if len(match) == 2 {
		return match[1]
	}
	return ""
}
