// Package tooling implements build and notice tools. Run commands from the repository root.
package tooling

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

type target struct{ ID, OS, Arch string }

var targets = []target{{"darwin-arm64", "darwin", "arm64"}, {"linux-x64", "linux", "amd64"}, {"windows-x64", "windows", "amd64"}}
var binaryVersionPattern = regexp.MustCompile(`^[0-9A-Za-z.+-]+$`)

func Run(args []string) error {
	if len(args) == 0 {
		return errors.New("expected build, install, dist, or notices")
	}
	flags := flag.NewFlagSet(args[0], flag.ContinueOnError)
	version := flags.String("version", "", "binary or release version")
	output := flags.String("output", "", "output path")
	binaryVersion := flags.String("binary-version", "", "override binary version in an archive")
	var selected stringList
	flags.Var(&selected, "target", "target (repeatable for dist)")
	if err := flags.Parse(args[1:]); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return fmt.Errorf("unexpected arguments: %v", flags.Args())
	}
	switch args[0] {
	case "build", "install":
		if *version == "" {
			*version = "0.0.0-dev"
		}
		if len(selected) > 1 {
			return errors.New("build and install accept one target")
		}
		var t *target
		if len(selected) == 1 {
			v, err := findTarget(selected[0])
			if err != nil {
				return err
			}
			t = &v
		}
		if args[0] == "install" {
			if t != nil {
				return errors.New("install builds for the current host; omit --target")
			}
			return install(*version)
		}
		if *output == "" {
			*output = "sadoku"
			if t != nil && t.OS == "windows" || t == nil && runtime.GOOS == "windows" {
				*output += ".exe"
			}
		}
		return build(*version, *output, t)
	case "dist":
		return dist(*version, *binaryVersion, selected)
	case "notices":
		if *output == "" {
			*output = "THIRD_PARTY_NOTICES.md"
		}
		return generateNotices(*output)
	default:
		return fmt.Errorf("unknown command: %s", args[0])
	}
}

type stringList []string

func (s *stringList) String() string     { return strings.Join(*s, ",") }
func (s *stringList) Set(v string) error { *s = append(*s, v); return nil }
func findTarget(id string) (target, error) {
	for _, t := range targets {
		if t.ID == id {
			return t, nil
		}
	}
	return target{}, fmt.Errorf("unknown target: %s", id)
}
func build(version, output string, t *target) error {
	if !binaryVersionPattern.MatchString(version) {
		return fmt.Errorf("invalid binary version: %s", version)
	}
	// Explicitly select the host for installs, even when the caller has GOOS/GOARCH set.
	osName, arch := runtime.GOOS, runtime.GOARCH
	if t != nil {
		osName, arch = t.OS, t.Arch
	}
	if (osName != runtime.GOOS || arch != runtime.GOARCH) && os.Getenv("CC") == "" {
		return fmt.Errorf("CGO cross-compilation for %s/%s requires a target C compiler; set CC or build on the target platform", osName, arch)
	}
	linkFlags := "-s -w -X github.com/mukopikmin/sadoku/src/server/cli.Version=" + version
	if osName == "linux" {
		linkFlags += " -extldflags=-static"
	}
	// Keep Go's resolver/user lookup behavior and avoid dlopen dependencies in
	// static Linux binaries. SQLite itself is bundled by the CGO driver.
	cmd := exec.Command("go", "build", "-trimpath", "-tags", "netgo,osusergo,sqlite_omit_load_extension", "-ldflags", linkFlags, "-o", output, "./cmd/sadoku")
	cmd.Env = append(os.Environ(), "CGO_ENABLED=1", "GOOS="+osName, "GOARCH="+arch)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
func install(version string) error {
	if runtime.GOOS != "darwin" && runtime.GOOS != "linux" {
		return errors.New("source install supports only macOS and Linux")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	return installInto(filepath.Join(home, ".local", "bin"), version, func(version, output string) error { return build(version, output, nil) })
}

func installInto(dir, version string, compile func(string, string) error) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	temp, err := os.CreateTemp(dir, ".sadoku-*")
	if err != nil {
		return err
	}
	name := temp.Name()
	temp.Close()
	defer os.Remove(name)
	if err = compile(version, name); err != nil {
		return err
	}
	if err = os.Chmod(name, 0755); err != nil {
		return err
	}
	path := filepath.Join(dir, "sadoku")
	if err = os.Rename(name, path); err != nil {
		return err
	}
	fmt.Println("Installed sadoku to", path)
	return nil
}
func atomicWrite(path string, data []byte, mode os.FileMode) error {
	f, err := os.CreateTemp(filepath.Dir(path), ".sadoku-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err = f.Chmod(mode); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), path)
}

type commandResult struct {
	Success        bool
	Stdout, Stderr string
}

func execute(name string, args ...string) commandResult {
	var stdout, stderr bytes.Buffer
	cmd := exec.Command(name, args...)
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil && stderr.Len() == 0 {
		stderr.WriteString(err.Error())
	}
	return commandResult{err == nil, strings.TrimSpace(stdout.String()), strings.TrimSpace(stderr.String())}
}
func required(r commandResult, description string) (string, error) {
	if !r.Success {
		return "", fmt.Errorf("%s: %s", description, r.Stderr)
	}
	return r.Stdout, nil
}
