# Development

[Back to README](../README.md)

Use GNU Make as the entry point for repository tasks. Go 1.26.10 or later runs
the backend, CLI, build, and notice tools. Release validation and notes run in
GitHub Actions using Bash, Git, GitHub CLI, and jq. Node.js runs the preview
client and npm tooling; its required version is specified in `package.json`.

The root `Makefile` includes `make/proto.mk` and `make/proxy.mk` for protobuf
and proxy tasks. Run all targets from the repository root.

SQLite uses `mattn/go-sqlite3` with CGO enabled. Building from source requires
a C compiler: GCC and libc development headers on Linux, Xcode Command Line
Tools on macOS, or MinGW-w64 GCC on Windows. Make enables CGO for backend tasks.
Downloaded release binaries include SQLite and do not require a C compiler or
a separate SQLite installation.

```sh
make deps
make start ARGS=README.md
```

The root `package.json` manages Node dependencies only. Make defines dependency
installation, formatting, action tests, and protobuf generation; npm executes
local tools with `npm exec --no` so missing tools are not downloaded implicitly.
The preview package retains its Vite and Vitest scripts:

```sh
make check                       # formatting and go vet
make test                        # server, client, action, and proxy tests
make test-tools                  # repository tooling tests
make build VERSION=1.2.3          # standalone binary with embedded client assets
make build TARGET=windows-x64 OUTPUT=sadoku.exe VERSION=1.2.3 # on Windows
make install VERSION=1.2.3        # source installation on macOS/Linux
make dist VERSION=1.2.3           # archive for the current platform
make notices
```

Build, install, server test, and vet targets build the client assets first. Run
`make deps` before these targets when setting up a checkout. The standalone
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
bindings share `proto/sadoku/preview/v1/preview.proto`.

Server and tooling tests use Go. The inline GitHub JavaScript action test uses
Node's built-in test runner. Generated TypeScript bindings and the Node test use
Prettier; Go formatting uses `gofmt`.

See [contributor guidelines](../AGENTS.md), [proxy setup](../proxy/README.md), and the
[release workflow guide](../.agents/skills/sadoku-release/SKILL.md) for details.

See [stable release operations](releases.md) for tag metadata and workflow safeguards.

## Nightly builds

For nightly builds, pass `--nightly` to `install.sh` or `-Nightly` to
`install.ps1`; update with `sadoku update --channel nightly`.
