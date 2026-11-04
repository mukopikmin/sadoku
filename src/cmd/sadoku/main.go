package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/mukopikmin/sadoku/src/internal/server"
	"github.com/mukopikmin/sadoku/src/internal/server/cli"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := server.Run(ctx, os.Args[1:], os.Stdout); err != nil {
		cli.WriteError(os.Stderr, err)
		os.Exit(1)
	}
}
