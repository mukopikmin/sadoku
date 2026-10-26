package config

import (
	"fmt"
	"math"
)

// Validate decoded TOML values before assigning Go types. The original runtime
// treated integral TOML floats as integers and reported field-specific errors.
func settingsFromConfig(values map[string]any) (Settings, error) {
	s := Defaults()
	if value, exists := values["commentsDirectory"]; exists {
		if _, ok := value.(string); !ok {
			return s, fmt.Errorf("commentsDirectory in Sadoku config must be a string.")
		}
	}
	for _, field := range []struct {
		key           string
		target        *string
		first, second string
	}{
		{"theme_mode", &s.Theme, "dark", "light"},
		{"code_wrap_mode", &s.CodeWrap, "scroll", "wrap"},
	} {
		if value, exists := values[field.key]; exists {
			text, ok := value.(string)
			if !ok || (text != field.first && text != field.second) {
				return s, fmt.Errorf("%s in Sadoku config must be either %q or %q.", field.key, field.first, field.second)
			}
			*field.target = text
		}
	}
	for _, field := range []struct {
		key         string
		target      *int
		min         int
		description string
	}{
		{"directory_max_depth", &s.MaxDepth, 0, "a non-negative integer"},
		{"directory_max_files", &s.MaxFiles, 1, "a positive integer"},
	} {
		if value, exists := values[field.key]; exists {
			n, ok := configNumber(value)
			if !ok || math.IsNaN(n) || math.IsInf(n, 0) || math.Trunc(n) != n || n < float64(field.min) || n >= float64(math.MaxInt) {
				return s, fmt.Errorf("%s in Sadoku config must be %s.", field.key, field.description)
			}
			*field.target = int(n)
		}
	}
	for _, field := range []struct {
		key         string
		target      *[]string
		description string
	}{
		{"excluded_directories", &s.ExcludedDirectories, "an array of unique directory names"},
		{"markdown_extensions", &s.MarkdownExtensions, "a non-empty array of unique file extensions beginning with a dot"},
	} {
		if value, exists := values[field.key]; exists {
			items, ok := value.([]any)
			if !ok {
				return s, fmt.Errorf("%s in Sadoku config must be %s.", field.key, field.description)
			}
			strings := make([]string, len(items))
			for i, item := range items {
				text, valid := item.(string)
				if !valid {
					return s, fmt.Errorf("%s in Sadoku config must be %s.", field.key, field.description)
				}
				strings[i] = text
			}
			*field.target = strings
			if Validate(s, false) != nil {
				return s, fmt.Errorf("%s in Sadoku config must be %s.", field.key, field.description)
			}
		}
	}
	if value, exists := values["show_html_comments"]; exists {
		b, ok := value.(bool)
		if !ok {
			return s, fmt.Errorf("show_html_comments in Sadoku config must be a boolean.")
		}
		s.ShowHTMLComments = b
	}
	if value, exists := values["font_scale"]; exists {
		n, ok := configNumber(value)
		if !ok || math.IsNaN(n) || n < 0.75 || n > 1.5 {
			return s, fmt.Errorf("font_scale in Sadoku config must be a finite number between 0.75 and 1.5.")
		}
		s.FontScale = n
	}
	return s, nil
}

func configNumber(value any) (float64, bool) {
	switch n := value.(type) {
	case int64:
		return float64(n), true
	case float64:
		return n, true
	default:
		return 0, false
	}
}
