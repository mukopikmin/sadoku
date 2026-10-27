package cli

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"unicode"
)

func browserCommand(target, platform, custom string) (string, []string) {
	words := []string{}
	var current strings.Builder
	var quote rune
	for _, r := range strings.TrimSpace(custom) {
		if quote != 0 {
			if r == quote {
				quote = 0
			} else {
				current.WriteRune(r)
			}
			continue
		}
		if r == '\'' || r == '"' {
			quote = r
			continue
		}
		if unicode.IsSpace(r) {
			if current.Len() > 0 {
				words = append(words, current.String())
				current.Reset()
			}
			continue
		}
		current.WriteRune(r)
	}
	if current.Len() > 0 {
		words = append(words, current.String())
	}
	if len(words) > 0 {
		args := append([]string{}, words[1:]...)
		placeholder := false
		for i, arg := range args {
			if strings.Contains(arg, "%s") {
				placeholder = true
				args[i] = strings.ReplaceAll(arg, "%s", target)
			}
		}
		if !placeholder {
			args = append(args, target)
		}
		return words[0], args
	}
	switch platform {
	case "darwin":
		return "open", []string{target}
	case "windows":
		return "cmd", []string{"/c", "start", "", target}
	default:
		return "xdg-open", []string{target}
	}
}
func OpenBrowser(target string) error {
	command, args := browserCommand(target, runtime.GOOS, os.Getenv("BROWSER"))
	err := exec.Command(command, args...).Run()
	if exit, ok := err.(*exec.ExitError); ok {
		return fmt.Errorf("%s exited with %d.", command, exit.ExitCode())
	}
	return err
}
