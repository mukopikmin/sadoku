package cli

import "golang.org/x/sys/windows"

func terminalInput(fd uintptr) bool {
	var mode uint32
	return windows.GetConsoleMode(windows.Handle(fd), &mode) == nil
}
