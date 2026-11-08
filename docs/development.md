# Development

[Back to README](../README.md)

Use GNU Make as the entry point for repository tasks. Go 1.27.3 or later runs
the backend, CLI, build, and notice tools. Release validation and notes run in
GitHub Actions using Bash, Git, GitHub CLI, and jq. Node.js runs the preview
client and npm tooling; its required version is specified in `src/proto/package.json`.

SQLite uses `mattn/go-sqlite3` with CGO enabled. Building from source requires
a C compiler: GCC and libc development headers on Linux, Xcode Command Line
Tools on macOS, or MinGW-w64 GCC on Windows. Make enables CGO for backend tasks.
Downloaded release binaries include SQLite and do not require a C compiler or
a separate SQLite installation.

```sh
make deps
make start ARGS=README.md
```

`src/proto/package.json` declares Node tooling dependencies only. Make defines shared
commands and includes `src/proto/tasks.mk` and `src/proxy/tasks.mk`; their targets use
`proto-` and `proxy-` prefixes. Run targets from the repository root.

```sh
make check                       # formatting, oxlint, and golangci-lint for both Go modules
make lint-go                     # lint the server, CLI, and repository tooling
make proxy-lint                  # lint the independent proxy module
make test                        # server, client, action, and proxy tests
make test-tools                  # repository tooling tests
make build VERSION=1.2.3          # standalone binary with embedded client assets
make build TARGET=windows-x64 OUTPUT=sadoku.exe VERSION=1.2.3 # on Windows
make install VERSION=1.2.3        # source installation on macOS/Linux
make dist VERSION=1.2.3           # archive for the current platform
make notices
```

Install the official [golangci-lint binary](https://github.com/golangci/golangci-lint/releases)
for the version pinned in [`.golangci-lint-version`](../.golangci-lint-version)
and put it on `PATH` before running lint or `make check`. Set `GOLANGCI_LINT`
to use a binary at another path. CI installs the same pinned version.
The shared [configuration](../.golangci.yml) enables correctness checks with
`staticcheck`, `errcheck`, `ineffassign`, `unused`, and `govet`, including tests
and excluding generated code. Formatting stays with `gofmt`; cross-platform
vet checks remain available through `make vet-cross`.

Keep intentional error discards local and explicit, such as cleanup and
best-effort log or HTTP output. Check errors when writing persistent data or
creating test fixtures instead of suppressing the linter for an entire file.

Build, install, server test, server lint, and vet targets build the client assets
first. Run `make deps` before these targets when setting up a checkout. The standalone
binary needs neither Go nor Node.js installed. Archive creation supports
`darwin-arm64`, `linux-x64`, and `windows-x64`. Use `TARGET=linux-x64` or
`TARGET=windows-x64` to select a distribution target explicitly. Cross-compiling
requires `CC` to select a C compiler and SDK for the target OS/architecture;
setting `GOOS` and `GOARCH` alone is insufficient. Stable and nightly workflows
build Linux x64 on Ubuntu 22.04, Windows x64 on Windows, and macOS ARM64 on
macOS ARM64, then combine the archives and checksums. Linux binaries are linked
statically; SQLite extension loading is disabled in distribution builds.
Nightly builds use
`make dist VERSION=nightly BINARY_VERSION=nightly-YYYYMMDD-COMMIT`.

Install the pinned Go protobuf generators with `make proto-tools` before
`make proto-check`; ensure `$(go env GOPATH)/bin` is on `PATH`. Go and TypeScript
bindings share `src/proto/sadoku/preview/v1/preview.proto`.

Server and tooling tests use Go. The inline GitHub JavaScript action test uses
Node's built-in test runner. Preview TypeScript, generated bindings, and the Node
test use oxfmt via
`make fmt-client` and `make check-client-format`. Handwritten TypeScript uses
oxlint via `make lint-client`, including React Hooks checks; generated bindings
are excluded from linting. Go formatting uses `gofmt`.

See [contributor guidelines](../AGENTS.md), [proxy setup](../src/proxy/README.md), and the
[release workflow guide](../.agents/skills/sadoku-release/SKILL.md) for details.

See [stable release operations](releases.md) for tag metadata and workflow safeguards.
See [preview sample data](preview.md) for local demos and
[Cloud Run previews](cloud-run-preview.md) for hosted preview setup and operation.

Task-specific plans, investigations, and verification notes belong in
[`docs/work/`](work/README.md). They may be committed, but have explicit deletion
conditions and are reviewed for cleanup when the related work finishes.

## Nightly builds

For nightly builds, pass `--nightly` to `scripts/install.sh` or `-Nightly` to
`scripts/install.ps1`; update with `sadoku update --channel nightly`.

## Source layout

`src/server/` owns the Go application module, entry points, internal server and
repository tooling, generated Go bindings, and integration tests.
`src/preview/` owns the browser client and generated TypeScript bindings.
`src/proxy/` remains an independent Go module. `src/proto/` owns protobuf
schemas, Buf configuration, and Node-based generation tools.

The root Makefile coordinates these applications. Client builds copy browser
assets into `src/server/internal/preview/dist/` for Go embedding; neither copy
of the generated assets is committed.
