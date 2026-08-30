# Sadoku

`sadoku` is a local Markdown review tool for reading, previewing, and commenting
on either a single Markdown document or the Markdown documents in a local
directory from your browser.

Run its `start` command with a Markdown file path, a directory, or an HTTP(S)
URL. It starts a local HTTP server, renders the source as HTML, prints the
preview URL, and opens that URL in your default browser. Review comments stay
separate from local Markdown files so the documents themselves stay clean.

Use **Instructions** in a document preview to keep multiple pieces of guidance
or background information alongside that document without adding them to its
Markdown source. Instructions are stored locally in Sadoku's database and can be
added, edited, or deleted independently.

## Install

On Linux x64 and macOS arm64, install the latest release binary to
`$HOME/.local/bin/sadoku` without cloning the repository:

```sh
curl -fsSL https://raw.githubusercontent.com/mukopikmin/sadoku/main/install.sh | sh
```

To install the latest tested nightly build instead:

```sh
curl -fsSL https://raw.githubusercontent.com/mukopikmin/sadoku/main/install.sh | sh -s -- --nightly
```

Make sure `$HOME/.local/bin` is included in your `PATH`.

On Windows x64, run the following command in PowerShell. The installer verifies
the release checksum, installs `sadoku.exe` under
`%LOCALAPPDATA%\Programs\sadoku`, and adds that directory to your user `PATH`:

```powershell
irm https://raw.githubusercontent.com/mukopikmin/sadoku/main/install.ps1 | iex
```

To install the latest tested nightly build instead:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/mukopikmin/sadoku/main/install.ps1))) -Nightly
```

An installed binary can update itself in place. Stable releases use GitHub's
latest release; nightly builds use the moving `nightly` release:

```sh
sadoku update
sadoku update --channel stable
sadoku update --channel nightly
```

The command first checks release metadata without downloading or replacing the
binary. If an update is available, Sadoku shows the target version and asks for
confirmation before downloading and installing it. No confirmation is shown when
the current version is already up to date or newer than the available version.

When `--channel` is omitted, versions in the `nightly-YYYYMMDD-<commit-hash>`
format stay on nightly. Release versions and builds whose origin cannot be
determined, including `0.0.0-dev`, default to stable. An explicit `--channel`
always takes precedence.

To build and install from source, clone the repository and run:

```sh
npm install
deno task install --version 0.1.0
```

Or compile a standalone binary in the project directory:

```sh
npm install
deno task compile --version 0.1.0
./sadoku start README.md
```

If `--version` is omitted, the compiled binary reports the development version
`0.0.0-dev`. Pass the release version explicitly when building release binaries.

## Usage

```sh
sadoku start <file.md|directory|url> [--max-depth <depth>] [--max-files <count>] [options]
sadoku document <add|inspect|list> ...
sadoku comment <operation> ...
sadoku update [--channel stable|nightly]
```

Self-update supports compiled Linux x64, macOS arm64, and Windows x64 binaries.
It verifies the downloaded archive's SHA-256 checksum before replacing the
executable. On Windows, replacement finishes in a background PowerShell process
after the current Sadoku process exits. Self-update is unavailable on
unsupported architectures, read-only installations, and source runs such as
`deno run src/main.ts`; use the installer or build tools in those cases.

Preview a file:

```sh
sadoku start README.md
```

Preview the Markdown documents in a directory:

```sh
sadoku start ./docs
```

For a directory preview, Sadoku scans up to two directory levels and loads up to
20 documents by default. Use `--max-depth` to change the deepest level scanned
(`0` scans only the specified directory) and `--max-files` to change the file
limit. The document list contains at most `--max-files` entries in total,
including saved entries for files that were deleted. A saved document is marked
as deleted only when its path no longer exists; files omitted because the scan
reached its file or depth limit, or because they are under excluded `.git` or
`node_modules` directories, are not reported as deleted:

```sh
sadoku start ./docs --max-depth 4 --max-files 100
```

These defaults can also be changed under **Settings → Directory discovery** in
the preview. Settings saved there apply when the next directory preview starts;
command-line options override the saved defaults for that invocation.

A document must be a regular file whose extension is `.md` or `.markdown`,
compared case-insensitively; `.git` and `node_modules` directories and symbolic
links are not followed.

The initial screen lists the discovered documents. Selecting a document stores
the selection in React state without changing the URL. Reloading the page
returns to the list, as does the `Documents` action in an open document.

The document list is generated once at startup. Files added or removed after
startup are not reflected automatically, but change notifications continue to
work for the selected document.

The directory-preview implementation does not include `.gitignore` handling,
search, per-document URLs, live rescanning of the directory, or deletion of
individual comments from the CLI.

Preview Markdown from a URL:

```sh
sadoku start 'https://example.com/README.md?token=temporary'
```

Use a different port:

```sh
sadoku start README.md --port 4000
```

If the requested port is already in use, `sadoku` increments it until an
available port is found.

Bind to a specific host and port:

```sh
sadoku start README.md --host 127.0.0.1 --port 4000
```

Print the URL without opening a browser:

```sh
sadoku start README.md --no-open
```

Keep the server running after the preview tab is closed:

```sh
sadoku start README.md --keep-alive
```

By default, the server reads the Markdown file or fetches the Markdown URL again
on each request, so refreshing the page shows recent edits. When a local
Markdown file changes, the browser preview shows a reload button so you can
refresh it when you are ready.

The preview settings can switch code blocks between horizontal scrolling and
soft wrapping. Long text without spaces, including Japanese text, wraps when
soft wrapping is enabled. The selected behavior is saved in the Sadoku config.

By default, the server stops after the browser tab is closed. Use `--keep-alive`
when you want to leave the server running.

Comments are stored outside the Markdown file's directory so they do not appear
as repository changes. The default comments directory is:

- macOS: `~/Library/Application Support/sadoku/comments`
- Linux: `$XDG_DATA_HOME/sadoku/comments`, or `~/.local/share/sadoku/comments`
- Windows: `%APPDATA%\sadoku\comments`

Set `commentsDirectory` in the Sadoku config file to choose a different comments
directory:

- macOS and Linux: `$XDG_CONFIG_HOME/sadoku/config.toml`, or
  `~/.config/sadoku/config.toml`
- Windows: `%APPDATA%\sadoku\config.toml`

```toml
commentsDirectory = "/path/to/sadoku/comments"
theme_mode = "dark"
```

Set `theme_mode` to `"dark"` or `"light"` to select the corresponding theme.
When it is omitted, Sadoku follows the browser's `prefers-color-scheme` setting.
Theme changes made in the preview update this setting.

Sadoku stores comments in `commentsDirectory/sadoku.sqlite3` by default.

JSON comment files created by earlier versions are not imported or read by the
SQLite store. Keep a backup of those files and use the earlier Sadoku version
that created them if you need to read or export their contents; Sadoku does not
currently include a JSON-to-SQLite migration command.

For URL previews, comments are keyed by the URL without its query string or
fragment. The full URL is still used to fetch Markdown, so temporary tokens can
be present in the URL without splitting comments across multiple comment files.

Register a document and use its stable ID in later commands:

```sh
sadoku document add README.md
sadoku document list
sadoku document inspect <document-id>
```

List comments for a registered document:

```sh
sadoku comment list --document <document-id>
```

You can select a document by source instead. By default the source must already
be registered. `comment add` can register it idempotently with
`--ensure-document`:

```sh
sadoku comment add --source README.md --ensure-document \
  --start-line 10 --end-line 12 --body "Check this section."
```

When `--end-line` is omitted, it defaults to `--start-line`. Comment input uses
named options so IDs, line numbers, and bodies cannot be confused:

```sh
sadoku comment add --document <document-id> \
  --start-line 10 --body "Check this line."
sadoku comment update <comment-id> --document <document-id> \
  --body "Updated comment."
sadoku comment delete <comment-id> --document <document-id>
```

Resolve or reopen one or more comments:

```sh
sadoku comment resolve <comment-id>... --document <document-id> [--as-bot]
sadoku comment reopen <comment-id>... --document <document-id>
```

Reply operations remain nested under the singular `comment` resource:

```sh
sadoku comment reply add --document <document-id> --comment <comment-id> \
  --body "Need more context."
sadoku comment reply update <reply-id> --document <document-id> \
  --comment <comment-id> --body "Updated reply."
sadoku comment reply delete <reply-id> --document <document-id> \
  --comment <comment-id>
```

Pass `--as-bot` to comment creation, resolution, or reply creation to attribute
the action to a bot. `--request-review` is accepted for bot reply creation.

## Comment Storage

Sadoku stores comments in the platform-specific application data directory by
default. Set `SADOKU_COMMENTS_DIR` to choose a different location.

For migration from mdview, Sadoku can still read `MDVIEW_COMMENTS_DIR`, existing
mdview comment directories, and legacy `*.mdview-comments.json` sidecar files.

## Options

| Option              | Description                                                | Default                |
| ------------------- | ---------------------------------------------------------- | ---------------------- |
| `-p, --port <port>` | Starting port. Increments when in use.                     | `3334`                 |
| `--host <host>`     | Hostname or IP address to bind.                            | `127.0.0.1`            |
| `--no-open`         | Do not open the preview URL in your browser automatically. | Opens browser          |
| `--keep-alive`      | Keep the server running after the browser tab is closed.   | Stops after tab closes |
| `--max-depth <n>`   | Maximum directory depth to scan.                           | `2`                    |
| `--max-files <n>`   | Maximum number of Markdown files to load.                  | `20`                   |
| `--document <id>`   | Select an existing document by ID.                         |                        |
| `--source <source>` | Select a registered Markdown file or URL.                  |                        |
| `--ensure-document` | Register `--source` when adding a comment.                 | Disabled               |
| `--comment <id>`    | Select the parent comment for a reply operation.           |                        |
| `--start-line <n>`  | Select the first line for a new comment.                   |                        |
| `--end-line <n>`    | Select the last line for a new comment.                    | Start line             |
| `--body <text>`     | Set the comment or reply body.                             |                        |
| `--as-bot`          | Attribute comment actions to a bot.                        | Human                  |
| `--request-review`  | Mark a bot reply as requesting review.                     | Disabled               |
| `-v, --version`     | Print the CLI version.                                     |                        |
| `-h, --help`        | Print command help.                                        |                        |

## Browser Opening

`sadoku` opens the preview with the platform default opener:

- macOS: `open`
- Windows: `cmd /c start`
- Linux: `xdg-open`

Set `BROWSER` to choose the opener command explicitly. If the command contains
`%s`, `sadoku` replaces it with the preview URL. Otherwise, the URL is appended
as the last argument.

```sh
BROWSER=explorer.exe sadoku start README.md
BROWSER='chrome.exe --new-window %s' sadoku start README.md
```

## Development

Install dependencies:

```sh
npm install
```

Runtime and maintenance-task permissions are defined as named permission sets in
`deno.json`. Keep task commands using their corresponding `-P` permission set
instead of duplicating `--allow-*` flags.

Run the CLI with Deno:

```sh
deno task start README.md
```

Compile a standalone binary:

```sh
deno task compile
./sadoku start README.md
```

On Linux and macOS, build in a temporary directory and install the binary to
`$HOME/.local/bin/sadoku`:

```sh
deno task install
```

## Release Archives

The latest tested commit from `main` is published as the `nightly` prerelease.
Its moving `nightly` tag and assets are replaced whenever the `Test` workflow
succeeds on `main`. This channel is independent of stable releases, so
publishing a new stable version does not change the nightly name or make the
nightly temporarily unavailable.

Stable release tags and archive versions include a leading `v` (for example,
`v0.1.0` and `sadoku-v0.1.0-linux-x64.tar.gz`). Nightly archives instead use the
channel name directly, for example `sadoku-nightly-linux-x64.tar.gz`. Nightly
binaries report a version containing the tested commit's UTC date and short
commit hash, such as `nightly-20260729-a1b2c3d4`.

The installer and `sadoku update` both download from
`https://github.com/mukopikmin/sadoku`. Stable Unix assets are named
`sadoku-v<version>-<target>.tar.gz`, while moving nightly Unix assets are named
`sadoku-nightly-<target>.tar.gz`. Windows assets use the corresponding `.zip`
names. Each archive has a same-name `.sha256` companion. Self-update supports
the `linux-x64`, `darwin-arm64`, and `windows-x64` targets.

Build release archives under `dist/`:

```sh
npm install
deno task dist --version 0.1.0
```

The release build creates archives for:

- `darwin-arm64`
- `linux-x64`
- `windows-x64`

To build a single target:

```sh
deno task dist --version 0.1.0 --target linux-x64
```

Each archive includes the `sadoku` binary, `LICENSE`, and
`THIRD_PARTY_NOTICES.md`. macOS and Linux targets are packaged as `.tar.gz`;
Windows is packaged as `.zip`. `dist/checksums.txt` and per-archive `.sha256`
files are generated for the final archives.

The release build uses the system `tar` command for `.tar.gz` archives and the
system `zip` command for the Windows archive. A full release build requires both
commands. A single-target build only requires the archive command for that
target.

For native targets, the release build starts the compiled binary on
`127.0.0.1:39731` to verify that bundled Mermaid assets can be served.

## Supported Markdown

| Feature                                            | Status        | Notes                                                                        |
| -------------------------------------------------- | ------------- | ---------------------------------------------------------------------------- |
| Headings and paragraphs                            | Supported     | Rendered through the React preview client.                                   |
| Bold and italic emphasis                           | Supported     | `**bold**` and `_italic_` render as emphasis.                                |
| Unordered, ordered, and nested lists               | Supported     | Nested unordered and ordered lists are preserved.                            |
| Blockquotes and horizontal rules                   | Supported     | Standard quote blocks and thematic breaks render normally.                   |
| Links and images                                   | Supported     | Links open in a new tab; link and image titles are preserved.                |
| Reference-style links and images                   | Supported     | Link definitions such as `[id]: https://example.com` are resolved.           |
| Inline code, indented code, and fenced code blocks | Supported     | Code content is escaped by default.                                          |
| Hard line breaks                                   | Supported     | Standard Markdown hard breaks render as line breaks.                         |
| Backslash escapes and HTML entities                | Supported     | Markdown escapes and entities are handled by the Markdown parser.            |
| Heading anchor links                               | Supported     | Headings get stable `id` attributes and clickable anchors.                   |
| Plain URL autolinks                                | Supported     | Plain URLs are converted to links.                                           |
| Task list checkboxes                               | Supported     | `- [ ]` and `- [x]` render as disabled checkboxes.                           |
| Strikethrough                                      | Supported     | `~~deleted~~` renders as deleted text.                                       |
| GitHub-style tables                                | Supported     | Table alignment markers are preserved.                                       |
| Syntax highlighting                                | Supported     | Common code fence languages are highlighted with highlight.js.               |
| Mermaid diagrams                                   | Supported     | Fenced `mermaid` code blocks render from local preview assets.               |
| Raw HTML                                           | Not supported | Raw HTML is escaped for safer previews.                                      |
| Footnotes                                          | Not supported | No footnote plugin is enabled.                                               |
| Definition lists                                   | Not supported | No definition list plugin is enabled.                                        |
| Math or LaTeX                                      | Not supported | Math rendering is not bundled.                                               |
| Agent-file front matter                            | Supported     | Metadata in recognized agent instruction files is shown as a safe data list. |
| Generated table of contents                        | Supported     | A floating document action opens heading hash links from the bottom right.   |

Mermaid rendering is served from local preview assets generated by
`npm run build:client`.

Comments and replies render standard Markdown and the GFM features listed above
after they are saved. Raw HTML remains escaped, and Mermaid diagrams are
rendered only in the document preview, not inside comment threads.

Third-party license notices for release archives are generated from lockfiles
and installed package license files. `THIRD_PARTY_NOTICES.md` is generated at
release build time and is not committed:

```sh
npm install
deno task notices
```
