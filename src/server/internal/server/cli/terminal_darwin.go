package cli

import "golang.org/x/sys/unix"

func terminalInput(fd uintptr) bool {
	_, err := unix.IoctlGetTermios(int(fd), unix.TIOCGETA)
	return err == nil
}
