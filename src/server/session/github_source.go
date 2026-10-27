package session

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/mukopikmin/sadoku/src/server/config"
)

func readPullDetails(ctx context.Context, endpoint string, metadata bool) (pullDetails, error) {
	var result pullDetails
	data, err := gh(ctx, endpoint, nil, false)
	if err != nil {
		return result, err
	}
	var fields map[string]json.RawMessage
	text := []byte(decodeText(data, true))
	if !json.Valid(text) {
		return result, fmt.Errorf("GitHub CLI returned invalid pull request JSON.")
	}
	if string(bytes.TrimSpace(text)) == "null" {
		return result, fmt.Errorf("Cannot read properties of null (reading 'head')")
	}
	if json.Unmarshal(text, &fields) != nil {
		return result, fmt.Errorf("GitHub API response did not contain the pull request head SHA.")
	}
	var head map[string]json.RawMessage
	if json.Unmarshal(fields["head"], &head) != nil || json.Unmarshal(head["sha"], &result.Head.SHA) != nil || result.Head.SHA == "" {
		return result, fmt.Errorf("GitHub API response did not contain the pull request head SHA.")
	}
	if metadata {
		title, exists := fields["title"]
		result.titlePresent = exists
		if exists && (string(title) == "null" || json.Unmarshal(title, &result.Title) != nil) {
			return result, fmt.Errorf("GitHub API response did not contain a valid pull request title.")
		}
		if body, exists := fields["body"]; exists && string(body) != "null" && json.Unmarshal(body, &result.Body) != nil {
			return result, fmt.Errorf("GitHub API response did not contain a valid pull request body.")
		}
		json.Unmarshal(fields["node_id"], &result.NodeID)
		json.Unmarshal(fields["state"], &result.State)
	}
	return result, nil
}

func readPullFilePage(ctx context.Context, p *Pull, page int) ([]any, error) {
	data, err := gh(ctx, fmt.Sprintf("%s/files?per_page=100&page=%d", p.endpoint(), page), nil, false)
	if err != nil {
		return nil, fmt.Errorf("Failed to list page %d of GitHub pull request files: %w", page, err)
	}
	var value any
	if json.Unmarshal([]byte(decodeText(data, true)), &value) != nil {
		return nil, fmt.Errorf("Failed to list page %d of GitHub pull request files: GitHub CLI returned invalid changed-files JSON.", page)
	}
	entries, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("GitHub CLI returned invalid changed-files JSON.")
	}
	return entries, nil
}

func pullFile(value any, property string) (changedFile, error) {
	if value == nil {
		return changedFile{}, fmt.Errorf("Cannot read properties of null (reading '%s')", property)
	}
	entry, _ := value.(map[string]any)
	name, _ := entry["filename"].(string)
	status, _ := entry["status"].(string)
	patch, _ := entry["patch"].(string)
	return changedFile{Filename: name, Status: status, Patch: patch}, nil
}

func listPullFiles(ctx context.Context, p *Pull, settings config.Settings) ([]changedFile, error) {
	files := []changedFile{}
	for page := 1; len(files) < settings.MaxFiles; page++ {
		entries, err := readPullFilePage(ctx, p, page)
		if err != nil {
			return nil, err
		}
		for _, value := range entries {
			file, err := pullFile(value, "status")
			if err != nil {
				return nil, err
			}
			if file.Status == "removed" {
				continue
			}
			for _, extension := range settings.MarkdownExtensions {
				if strings.EqualFold(filepath.Ext(file.Filename), extension) {
					files = append(files, file)
					break
				}
			}
			if len(files) >= settings.MaxFiles {
				break
			}
		}
		if len(entries) < 100 {
			break
		}
	}
	return files, nil
}

func supportsPullRange(ctx context.Context, p *Pull, path string, start, end int) (bool, error) {
	hunk := regexp.MustCompile(`^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@`)
	for page := 1; ; page++ {
		files, err := readPullFilePage(ctx, p, page)
		if err != nil {
			return false, err
		}
		for _, value := range files {
			file, err := pullFile(value, "filename")
			if err != nil {
				return false, err
			}
			if file.Filename != path {
				continue
			}
			if file.Status == "removed" {
				return false, nil
			}
			for _, line := range strings.Split(file.Patch, "\n") {
				match := hunk.FindStringSubmatch(line)
				if match == nil {
					continue
				}
				first, _ := strconv.Atoi(match[1])
				length := 1
				if match[2] != "" {
					length, _ = strconv.Atoi(match[2])
				}
				if start >= first && end < first+length {
					return true, nil
				}
			}
			return false, nil
		}
		if len(files) < 100 {
			return false, nil
		}
	}
}

// Export validates presence and types before any mutation, without requiring
// preview-only metadata such as the title or description.
func readExportPull(ctx context.Context, endpoint string) (pullDetails, error) {
	var value struct {
		NodeID *string `json:"node_id"`
		State  *string
		Head   *struct{ SHA *string }
	}
	var result pullDetails
	if err := ghJSON(ctx, endpoint, nil, &value); err != nil {
		return result, err
	}
	if value.NodeID == nil || value.State == nil || value.Head == nil || value.Head.SHA == nil {
		return result, fmt.Errorf("GitHub returned invalid pull request data.")
	}
	result.NodeID = *value.NodeID
	result.State = *value.State
	result.Head.SHA = *value.Head.SHA
	return result, nil
}

func (p *Pull) exportURL() string {
	return fmt.Sprintf("https://github.com/%s/%s/pull/%d", p.Owner, p.Repo, p.Number)
}
