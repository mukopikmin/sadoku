// sadoku-tools runs repository maintenance commands from the repository root.
package main

import (
	"fmt"
	"github.com/mukopikmin/sadoku/internal/tooling"
	"os"
)

func main() {
	if err := tooling.Run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
