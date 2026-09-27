# Sadoku

Sadoku is a local Markdown review tool. Open a file, directory, or HTTP(S) URL
in your browser, preview the rendered Markdown, and leave comments without
changing the source document.

Document instructions, agent memories, and review comments are stored locally.
Remote URLs are fetched in full, but their query strings and fragments are
excluded from the stored document identity so credentials and temporary tokens
are not persisted.

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

Preview the Markdown files changed by a GitHub pull request:

```sh
sadoku start https://github.com/<owner>/<repo>/pull/<number>
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

GitHub pull request previews use the same configured Markdown extensions and
`--max-files` limit. They show added and modified Markdown files, omit deleted
files, and fetch every document at the pull request's current head commit. The
document identity remains stable when the branch advances. While the preview is
open, Sadoku checks the pull request head every 30 seconds. When it advances,
Sadoku refreshes the complete changed-Markdown list (including added, removed,
and renamed files) and shows the existing reload prompt in open documents.
Documents whose paths are unchanged keep their identity and comment storage when
the head advances; a renamed path is treated as the canonical identity of the
renamed document. To use this feature, install the
[GitHub CLI](https://cli.github.com/) and authenticate once with
`gh auth login --hostname github.com`. All pull request access, including public
repositories, uses `gh api`; Sadoku never reads or stores a GitHub token. Fetch
URLs, document identities, logs, and comment storage paths also contain no
credentials.

In a PR preview, choose **Save to GitHub review** from an active human comment's
menu to add it to your pending review. Sadoku discovers your existing review on
GitHub, including one started in a browser, or creates a pending review with the
first comment. Nothing is submitted automatically; use **View pending GitHub
review** to finish or discard the review on GitHub. Review IDs are not stored
locally. Replies are excluded.

The displayed Markdown must exactly match the remote document, and the preview
must use the current PR head. Remote read failures or differences block saving.
The PR must be open and the selected lines must fit within one diff hunk. A
pending review must also target the current head; finish or discard an older
review on GitHub before adding comments for a newer revision.

Saving the same parent again updates its pending body when the revision and
lines still match. The explicit save uses the current local body. Already
submitted comments return their existing link and are left unchanged. Local
edits, resolution and deletion do not automatically change GitHub. See
[export behavior and edge cases](docs/github-comment-export.md) for details.

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

### Agent memories

Agents can keep reusable background knowledge separately from a document. Memory
commands use the same document selectors as instruction commands:

```sh
sadoku memory list --source README.md
sadoku memory add --source README.md --content "The audience is maintainers."
sadoku memory update 1 --source README.md --content "The audience is contributors."
sadoku memory delete 1 --source README.md
```

The preview UI lets people review and delete memories; additions and updates are
CLI-only. Memories are context rather than instructions. Do not store
credentials, access tokens, URL query parameters, or other secrets in them.

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
| Suggested edits in comments                          | Supported     | `suggest` and `suggestion` blocks render source diffs.         |
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
