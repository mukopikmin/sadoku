package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/pelletier/go-toml/v2"
)

type Settings struct {
	Theme               string   `json:"theme,omitempty" toml:"theme_mode,omitempty"`
	CodeWrap            string   `json:"codeWrap,omitempty" toml:"code_wrap_mode,omitempty"`
	FontScale           float64  `json:"fontScale" toml:"font_scale"`
	ExcludedDirectories []string `json:"excludedDirectories" toml:"excluded_directories"`
	MaxDepth            int      `json:"maxDepth" toml:"directory_max_depth"`
	MaxFiles            int      `json:"maxFiles" toml:"directory_max_files"`
	MarkdownExtensions  []string `json:"markdownExtensions" toml:"markdown_extensions"`
	ShowHTMLComments    bool     `json:"showHtmlComments" toml:"show_html_comments"`
}

func Defaults() Settings {
	return Settings{FontScale: 1, MaxDepth: 2, MaxFiles: 20, ExcludedDirectories: []string{".git", "node_modules"}, MarkdownExtensions: []string{".md", ".markdown"}, ShowHTMLComments: true}
}

func Path() string {
	if runtime.GOOS == "windows" && os.Getenv("APPDATA") != "" {
		return filepath.Join(os.Getenv("APPDATA"), "sadoku", "config.toml")
	}
	if p := os.Getenv("XDG_CONFIG_HOME"); p != "" {
		return filepath.Join(p, "sadoku", "config.toml")
	}
	p, _ := os.UserHomeDir()
	return filepath.Join(p, ".config", "sadoku", "config.toml")
}

func Read() (Settings, map[string]any, error) {
	s := Defaults()
	extra := map[string]any{}
	b, err := os.ReadFile(Path())
	if errors.Is(err, os.ErrNotExist) {
		return s, extra, nil
	}
	if err != nil {
		return s, extra, err
	}
	// Earlier versions also ignore syntactically invalid TOML.
	if err = toml.Unmarshal(b, &extra); err != nil {
		return s, map[string]any{}, nil
	}
	if err = toml.Unmarshal(b, &s); err != nil {
		return s, extra, err
	}
	if value, ok := extra["commentsDirectory"]; ok {
		if _, valid := value.(string); !valid {
			return s, extra, fmt.Errorf("commentsDirectory in Sadoku config must be a string")
		}
	}
	return s, extra, Validate(s, false)
}

func Validate(s Settings, complete bool) error {
	valid := (s.Theme == "dark" || s.Theme == "light" || (!complete && s.Theme == "")) && (s.CodeWrap == "wrap" || s.CodeWrap == "scroll" || (!complete && s.CodeWrap == "")) && s.FontScale >= 0.75 && s.FontScale <= 1.5 && s.MaxDepth >= 0 && s.MaxFiles > 0 && len(s.MarkdownExtensions) > 0
	seen := map[string]bool{}
	for _, v := range s.ExcludedDirectories {
		if v == "" || v == "." || v == ".." || strings.ContainsAny(v, "/\\") || seen[v] {
			valid = false
		}
		seen[v] = true
	}
	seen = map[string]bool{}
	for _, v := range s.MarkdownExtensions {
		lower := strings.ToLower(v)
		if !strings.HasPrefix(v, ".") || len(v) < 2 || strings.ContainsAny(v[1:], "./\\") || seen[lower] {
			valid = false
		}
		seen[lower] = true
	}
	if !valid {
		return fmt.Errorf("request must contain valid preview settings")
	}
	return nil
}

func Save(s Settings) error {
	if err := Validate(s, true); err != nil {
		return err
	}
	_, extra, err := Read()
	if err != nil {
		return err
	}
	// Runtime reads tolerate malformed TOML; writes must preserve the original
	// file until the user has repaired it, as earlier versions did.
	if existing, readErr := os.ReadFile(Path()); readErr == nil {
		if err = toml.Unmarshal(existing, &extra); err != nil {
			return err
		}
	} else if !errors.Is(readErr, os.ErrNotExist) {
		return readErr
	}
	b, err := toml.Marshal(s)
	if err != nil {
		return err
	}
	updates := map[string]any{}
	if err = toml.Unmarshal(b, &updates); err != nil {
		return err
	}
	for k, v := range updates {
		extra[k] = v
	}
	b, err = toml.Marshal(extra)
	if err != nil {
		return err
	}
	return AtomicWrite(Path(), b, 0600)
}

func AtomicWrite(path string, contents []byte, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".sadoku-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if err = f.Chmod(mode); err == nil {
		_, err = f.Write(contents)
	}
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	return os.Rename(f.Name(), path)
}

func CommentsDirectory() (string, error) {
	if p := os.Getenv("SADOKU_COMMENTS_DIR"); p != "" {
		return p, nil
	}
	_, extra, err := Read()
	if err != nil {
		return "", err
	}
	if p, ok := extra["commentsDirectory"].(string); ok && p != "" {
		return p, nil
	}
	if p := os.Getenv("MDVIEW_COMMENTS_DIR"); p != "" {
		return p, nil
	}
	home, _ := os.UserHomeDir()
	if runtime.GOOS == "darwin" {
		return filepath.Join(home, "Library", "Application Support", "sadoku", "comments"), nil
	}
	if runtime.GOOS == "windows" && os.Getenv("APPDATA") != "" {
		return filepath.Join(os.Getenv("APPDATA"), "sadoku", "comments"), nil
	}
	if p := os.Getenv("XDG_DATA_HOME"); p != "" {
		return filepath.Join(p, "sadoku", "comments"), nil
	}
	return filepath.Join(home, ".local", "share", "sadoku", "comments"), nil
}
