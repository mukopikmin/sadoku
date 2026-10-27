// Package preview contains the built browser client embedded in the Go binary.
// Run make build-client before building or testing the server.
package preview

import "embed"

//go:embed all:dist
var Assets embed.FS
