# Sadoku

Sadoku is a local Markdown review tool. Open a file, directory, or URL in your
browser, read the rendered Markdown, and leave comments without changing the
source document. Comments are saved locally.

## Install

**Linux x64 / macOS arm64:**

```sh
curl -fsSL https://raw.githubusercontent.com/mukopikmin/sadoku/main/scripts/install.sh | sh
```

**Windows x64 (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/mukopikmin/sadoku/main/scripts/install.ps1 | iex
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
Use `--no-open` to start without opening a browser, or `--port 4000` to choose
the starting port. `--no-sync` disables automatic external updates; use **Reload
preview** to fetch updates manually. The server then runs until Ctrl+C.
Run `sadoku --help` for all commands and options.

### Review

- Use the **+** button beside a document block to comment. Comments support
  Markdown and replies; discussions can be resolved and reopened.
- Use **Changes** to compare with the previous saved snapshot, or **Revisions**
  to browse history and restore a local file. Remote documents are read-only.
- Directory previews let you browse and create Markdown files. Discovery limits
  can be changed in **Settings → Directory discovery**.
- For GitHub PRs, install the [GitHub CLI](https://cli.github.com/) and run
  `gh auth login`. **Save to GitHub review** adds a comment to your pending review;
  finish or discard it on GitHub. Nothing is submitted automatically.
  See [GitHub export details](docs/github-comment-export.md) for limitations.

Comments can also be managed from the terminal and coding agents. See
[CLI and coding agents](docs/cli-and-agents.md) for commands and the
`sadoku-review` skill.

### Markdown

Supports GitHub Flavored Markdown, including tables, task lists, and syntax
highlighting, plus Mermaid diagrams rendered offline. Raw HTML is escaped;
footnotes, definition lists, and math/LaTeX are not supported.
Comments and replies support Markdown with GitHub-style line breaks;
Mermaid diagrams render only in documents.
Japanese fonts are bundled; see [font licenses](src/preview/public/fonts/noto-sans-jp/README.md).

### Settings and storage

Appearance and review settings are available under **Settings**. Comments,
instructions, and memories are saved in `sadoku.sqlite3` under:

- macOS: `~/Library/Application Support/sadoku/comments`
- Linux: `$XDG_DATA_HOME/sadoku/comments` or `~/.local/share/sadoku/comments`
- Windows: `%APPDATA%\sadoku\comments`

Set `SADOKU_COMMENTS_DIR` to change the storage directory. Settings are stored in
`$XDG_CONFIG_HOME/sadoku/config.toml` (default `~/.config/sadoku/config.toml`) on
macOS/Linux, or `%APPDATA%\sadoku\config.toml` on Windows.

## Development

Requires GNU Make, Go 1.26.10 or later, Node.js matching
[`src/proto/package.json`](src/proto/package.json), and a C compiler for SQLite (GCC and libc headers
on Linux, Xcode Command Line Tools on macOS, or MinGW-w64 GCC on Windows).
Make enables CGO for backend tasks.
Lint checks also require the golangci-lint version pinned in
[`.golangci-lint-version`](.golangci-lint-version); see
[development details](docs/development.md) for installation.

```sh
make deps                       # install dependencies from lockfiles
make start ARGS=README.md        # run locally
make build VERSION=0.0.0-dev      # build a binary with embedded client assets
make check                      # formatting and golangci-lint
make test                       # server, client, action, and proxy tests
```

Build, server test, server lint, and vet targets build the client assets first.
The resulting binary runs without Go or Node.js installed.

See [development details](docs/development.md) for additional build targets,
code generation, and release operations, and [AGENTS.md](AGENTS.md) for
contribution and documentation rules.
