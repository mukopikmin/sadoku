# Sadoku

Sadoku is a local Markdown review tool. Open a file, directory, or URL in your
browser, read the rendered Markdown, and leave comments without changing the
source document. Comments are saved locally.

## Install

**Linux x64 / macOS arm64:**

```sh
curl -fsSL https://raw.githubusercontent.com/mukopikmin/sadoku/main/install.sh | sh
```

**Windows x64 (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/mukopikmin/sadoku/main/install.ps1 | iex
```

On Linux and macOS, make sure `$HOME/.local/bin` is on `PATH`. To update:

```sh
sadoku update
```

For nightly builds, pass `--nightly` to `install.sh` or `-Nightly` to
`install.ps1`; update with `sadoku update --channel nightly`.

## Open a document

```sh
sadoku start README.md
```

Sadoku opens your default browser and serves the preview at `127.0.0.1:3334` (or
the next available port). You can also open a directory, a remote Markdown file,
or the Markdown files changed in a GitHub pull request:

```sh
sadoku start ./docs
sadoku start https://example.com/README.md
sadoku start https://github.com/<owner>/<repo>/pull/<number>
```

| Option                          | Purpose                                                             |
| ------------------------------- | ------------------------------------------------------------------- |
| `--port 4000`                   | Choose the starting port.                                           |
| `--no-open`                     | Start without opening a browser.                                    |
| `--keep-alive`                  | Keep running after the browser tab closes.                          |
| `--max-depth 4 --max-files 100` | Increase directory discovery limits (defaults: 2 levels, 20 files). |

Directory previews skip symbolic links, `.git`, and `node_modules` by default.
Discovery settings are also available under **Settings → Directory discovery**.
Run `sadoku --help` for all commands and options.

## Review documents

- Use the **+** button beside a document block to add a comment. Comments and
  replies support Markdown; comments can be resolved and reopened.
- In the comments view, select comments or use **Select all** to resolve,
  reopen, or delete them together. Deletion includes replies and asks for
  confirmation.
- In a local directory preview, choose **New file** or a folder's **+** button
  to create a Markdown file. The `.md` extension is added if omitted; an
  optional title appears above the document without changing its Markdown. Use
  **Set title** or **Edit title** to change it, or clear it to remove it.
  Existing files are never overwritten.
- Use **Zoom** on a Mermaid diagram to enlarge it. Pinch to zoom, scroll to
  move, and choose **Fit to view** to reset.

### GitHub pull requests

Install the [GitHub CLI](https://cli.github.com/) and authenticate before
opening a PR, including one in a public repository:

```sh
gh auth login --hostname github.com
sadoku start https://github.com/<owner>/<repo>/pull/<number>
```

Sadoku shows added and modified Markdown files and checks for new commits every
30 seconds. When prompted, reload to review the latest version.

Choose **Save to GitHub review** from an active human comment's menu to add it
to your pending review. Nothing is submitted automatically: use **View pending
GitHub review** to finish or discard it on GitHub. Replies are excluded, and
local edits or deletions do not automatically sync to GitHub.

Saving requires an open PR, an unchanged preview of the current head, and lines
within one diff hunk. Finish or discard a review on an older commit before
saving comments on a newer one. See
[GitHub export details](docs/github-comment-export.md) for update behavior and
other limitations.

## CLI and coding agents

You can also manage comments from the terminal:

```sh
sadoku comment add --source README.md --ensure-document --start-line 10 --body "Check this line."
sadoku comment list --source README.md
sadoku comment resolve <comment-id> --source README.md
```

Use `sadoku --help` for document, comment, instruction, and memory commands.
Instructions and memories provide document-specific context for agents; memories
can be reviewed and deleted in the preview, but are added and updated through
the CLI.

For compatible coding agents, install the `sadoku-review` skill with
[Agent Package Manager](https://github.com/microsoft/apm):

```sh
apm install mukopikmin/sadoku --skill sadoku-review
```

The skill requires `sadoku` on `PATH`.

## Settings and storage

Comments, instructions, and memories are stored in `sadoku.sqlite3`:

| Platform | Default directory                                                    |
| -------- | -------------------------------------------------------------------- |
| macOS    | `~/Library/Application Support/sadoku/comments`                      |
| Linux    | `$XDG_DATA_HOME/sadoku/comments` or `~/.local/share/sadoku/comments` |
| Windows  | `%APPDATA%\sadoku\comments`                                          |

Set `SADOKU_COMMENTS_DIR` to use another directory. Persistent settings are in
`$XDG_CONFIG_HOME/sadoku/config.toml` (or `~/.config/sadoku/config.toml`) on
macOS and Linux, and `%APPDATA%\sadoku\config.toml` on Windows. For example:

```toml
commentsDirectory = "/path/to/sadoku/comments"
theme_mode = "dark"
```

Remote URL query strings and fragments are excluded from stored document
identities. Sadoku uses `gh` for PR access without reading or storing a GitHub
token. Avoid putting secrets in comments, instructions, or memories.

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
| Single-newline line breaks in comments and replies   | Supported     | GitHub-style line breaks in comments and replies only.         |
| Mermaid diagrams                                     | Supported     | Local rendering; trackpad pinch zoom in the zoom dialog.       |
| HTML comments                                        | Supported     | Displayed as commentable plain-text cards.                     |
| Agent-file front matter                              | Supported     | Displayed as a safe data list in recognized instruction files. |
| Generated table of contents                          | Supported     | Available from the document action menu.                       |
| Raw HTML                                             | Not supported | Escaped for safer previews.                                    |
| Footnotes, definition lists, and math/LaTeX          | Not supported |                                                                |

Comments and replies support standard Markdown and GitHub Flavored Markdown.
Single newlines in comments and replies render as line breaks, like on GitHub.
Mermaid diagrams render only in document previews.

Japanese text uses bundled Noto Sans JP with no external font service. See the
[font notices and licenses](src/preview/public/fonts/noto-sans-jp/README.md).

## Development

Use Deno 2.8 and Node.js 24 to run from source:

```sh
npm install
deno task start README.md
```

Checks: `deno fmt --check`, `deno task check`, `npm test`, `deno task test`, and
`npm run proto:check`. Build a binary with `deno task compile`.

See [contributor guidelines](AGENTS.md), [proxy setup](proxy/README.md), and the
[release workflow guide](.agents/skills/sadoku-release/SKILL.md) for details.
