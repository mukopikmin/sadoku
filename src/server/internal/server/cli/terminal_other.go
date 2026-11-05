//go:build !linux && !darwin && !windows

package cli

func terminalInput(fd uintptr) bool { return false }
