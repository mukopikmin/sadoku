# Sadoku

Sadoku is a local Markdown review tool. Open a file, directory, or URL in your
browser, read the rendered Markdown, and leave comments without changing the
source document. Comments are saved locally.

- Review Markdown with tables, syntax highlighting, and offline Mermaid diagrams.
- Add comments and replies, resolve discussions, and manage them from the CLI.
- Compare saved revisions and restore local files.
- Review Markdown in GitHub pull requests and save comments to a pending review.

## Install

**Linux x64 / macOS arm64:**

```sh
curl -fsSL https://raw.githubusercontent.com/mukopikmin/sadoku/main/install.sh | sh
```

**Windows x64 (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/mukopikmin/sadoku/main/install.ps1 | iex
```

On Linux and macOS, make sure `$HOME/.local/bin` is on `PATH`.
Update with `sadoku update`.

## Usage

```sh
sadoku start README.md
sadoku start ./docs
sadoku start https://example.com/README.md
sadoku start https://github.com/<owner>/<repo>/pull/<number>
```

Sadoku opens your browser at `127.0.0.1:3334` (or the next available port).
Use the **+** button beside a document block to leave a comment.
GitHub PRs require the [GitHub CLI](https://cli.github.com/) and `gh auth login`.
Run `sadoku --help` for commands and options.

See the [user guide](docs/user-guide.md) for review operations, settings, storage,
and supported Markdown, or [CLI and coding agents](docs/cli-and-agents.md) for
terminal commands and the `sadoku-review` skill.

## Development

Requires GNU Make, Go 1.26.10 or later, Node.js matching
[`package.json`](package.json), and a C compiler for SQLite (GCC and libc headers
on Linux, Xcode Command Line Tools on macOS, or MinGW-w64 GCC on Windows).
Make enables CGO for backend tasks.

```sh
make deps                       # install dependencies from lockfiles
make start ARGS=README.md        # run locally
make build VERSION=0.0.0-dev      # build a binary with embedded client assets
make check                      # formatting and vet
make test                       # server, client, action, and proxy tests
```

Build, server test, and vet targets build the client assets first. The resulting
binary runs without Go or Node.js installed.

See [development details](docs/development.md) for additional build targets,
code generation, and release operations, and [AGENTS.md](AGENTS.md) for
contribution and documentation rules.
