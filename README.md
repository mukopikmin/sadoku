# Sadoku

Sadoku is a local Markdown review tool. Open a file, directory, or HTTP(S) URL
in your browser, preview the rendered Markdown, and leave comments without
changing the source document.

Document instructions and review comments are stored locally. Remote URLs are
fetched in full, but their query strings and fragments are excluded from the
stored document identity so credentials and temporary tokens are not persisted.

## Install

### Linux x64 and macOS arm64

```sh
curl -fsSL https://raw.githubusercontent.com/mukopikmin/sadoku/main/install.sh | sh
```

### Windows x64

Run in PowerShell:

```powershell
irm https://raw.githubusercontent.com/mukopikmin/sadoku/main/install.ps1 | iex
```

Both installers place Sadoku in a user-local application directory. On Linux and
macOS, make sure `$HOME/.local/bin` is on `PATH`.

To install the latest tested nightly build, pass `--nightly` to `install.sh` or
`-Nightly` to `install.ps1`.

Update an installed binary with:

```sh
sadoku update
sadoku update --channel nightly
```

## Quick start

Preview a file:

```sh
sadoku start README.md
```

Preview all supported Markdown files in a directory:

```sh
sadoku start ./docs
```

Preview a remote document:

```sh
sadoku start https://example.com/README.md
```

Sadoku binds to `127.0.0.1`, chooses port `3334` or the next available port, and
opens the preview in your default browser. Common options include:

```sh
sadoku start README.md --port 4000 --no-open
sadoku start ./docs --max-depth 4 --max-files 100
sadoku start README.md --keep-alive
```

Use `sadoku --help` for the complete command and option reference.

### Directory previews

Directory previews scan two levels and load up to 20 documents by default.
Change these limits with `--max-depth` and `--max-files`, or under **Settings →
Directory discovery**. Sadoku does not follow symbolic links and excludes `.git`
and `node_modules` by default.

### Comments from the CLI

Register and inspect documents:

```sh
sadoku document add README.md
sadoku document list
sadoku document inspect <document-id>
```

Manage comments by document ID:

```sh
sadoku comment list --document <document-id>
sadoku comment add --document <document-id> --start-line 10 --body "Check this line."
sadoku comment update <comment-id> --document <document-id> --body "Updated comment."
sadoku comment resolve <comment-id> --document <document-id>
sadoku comment delete <comment-id> --document <document-id>
```

Commands also accept `--source <file.md|url>`. Use `--ensure-document` with
`comment add` to register that source when needed. Run `sadoku comment --help`
for reply, reopen, bot attribution, and review-request options.

## Configuration and storage

Sadoku stores comments in `sadoku.sqlite3` under the platform application-data
directory:

- macOS: `~/Library/Application Support/sadoku/comments`
- Linux: `$XDG_DATA_HOME/sadoku/comments`, or `~/.local/share/sadoku/comments`
- Windows: `%APPDATA%\sadoku\comments`

Set `SADOKU_COMMENTS_DIR` to override this location. Persistent settings live in
`$XDG_CONFIG_HOME/sadoku/config.toml` (or `~/.config/sadoku/config.toml`) on
macOS and Linux, and `%APPDATA%\sadoku\config.toml` on Windows.

```toml
commentsDirectory = "/path/to/sadoku/comments"
theme_mode = "dark"
```

## Agent skill

Install the `sadoku-review` skill for compatible coding agents with
[Agent Package Manager](https://github.com/microsoft/apm):

```sh
apm install mukopikmin/sadoku --skill sadoku-review
```

The skill requires the `sadoku` executable on `PATH`.

## Development

```sh
npm install
deno task start README.md
```

Useful project tasks:

```sh
deno task check
deno task test
npm test
deno task compile
```

Pass `--version <version>` to `deno task compile` or `deno task install` when
building a versioned binary. Without it, the binary reports `0.0.0-dev`.

## Supported Markdown

| Feature                                              | Status        | Notes                                                          |
| ---------------------------------------------------- | ------------- | -------------------------------------------------------------- |
| Headings, paragraphs, emphasis, and horizontal rules | Supported     | Headings include anchor links.                                 |
| Ordered, unordered, nested, and task lists           | Supported     | Task checkboxes are read-only.                                 |
| Blockquotes                                          | Supported     |                                                                |
| Links and images                                     | Supported     | Inline, reference-style, and plain URL links are supported.    |
| Inline, indented, and fenced code                    | Supported     | Common languages receive syntax highlighting.                  |
| Tables and strikethrough                             | Supported     | GitHub Flavored Markdown syntax is supported.                  |
| Hard line breaks, escapes, and HTML entities         | Supported     |                                                                |
| Mermaid diagrams                                     | Supported     | Rendered from local assets without a CDN.                      |
| HTML comments                                        | Supported     | Displayed as commentable plain-text cards.                     |
| Agent-file front matter                              | Supported     | Displayed as a safe data list in recognized instruction files. |
| Generated table of contents                          | Supported     | Available from the document action menu.                       |
| Raw HTML                                             | Not supported | Escaped for safer previews.                                    |
| Footnotes, definition lists, and math/LaTeX          | Not supported |                                                                |

Comments and replies support standard Markdown and GitHub Flavored Markdown.
Mermaid diagrams render only in document previews.
