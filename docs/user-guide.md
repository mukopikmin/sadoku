# User guide

[Back to README](../README.md)

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
- Use **Zoom** on a Mermaid diagram to enlarge it. Use the **+** and **−**
  buttons or pinch to zoom, scroll to move, and choose **Fit to view** to reset.
- Toggle **Changes** in the document action bar to compare the rendered document
  with its previous saved snapshot. Removed blocks appear in red before added
  blocks in green, with colored gutters. Tables, lists, and code blocks are
  compared as whole blocks. Current content remains commentable; removed content
  is read-only. Comment ranges use outlines while changes are shown. The option
  is off initially and unavailable when no comparison data exists. The baseline
  is a saved snapshot, not the last time you viewed the document.
- Open **Revisions** in the document action bar to view the current document or
  choose from its latest 20 saved revisions, listed newest first with recording
  times. Each selected revision shows changes from its immediately preceding
  saved revision, with highlights and added/removed line counts. Current
  compares the live document with the latest saved revision. When their contents
  match, they share one Current entry, compared with that saved revision's
  predecessor. Older saved revisions remain stored. This does not change when
  document snapshots are recorded.
- To restore a local file, select a saved revision under **Revisions**, choose
  **Restore this revision**, and confirm **Restore file**. The current contents
  are kept in revision history. Deleted files can also be recreated if their
  parent folder still exists. Reload before restoring if the file has changed
  since you opened it. Remote URLs and GitHub PR files are read-only.

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
[GitHub export details](github-comment-export.md) for update behavior and
other limitations.

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

Enable **Settings → Show highlight boundaries** to outline commentable blocks,
range highlights, and revision highlights for spacing inspection. This setting
is off by default and is saved as `show_highlight_boundaries` in `config.toml`.

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
| Mermaid diagrams                                     | Supported     | Local rendering; zoom buttons and trackpad pinch in the dialog. |
| HTML comments                                        | Supported     | Commentable plain-text cards; visible by default (Settings).   |
| Agent-file front matter                              | Supported     | Displayed as a safe data list in recognized instruction files. |
| Generated table of contents                          | Supported     | Available from the document action menu.                       |
| Raw HTML                                             | Not supported | Escaped for safer previews.                                    |
| Footnotes, definition lists, and math/LaTeX          | Not supported |                                                                |

Comments and replies support standard Markdown and GitHub Flavored Markdown.
Single newlines in comments and replies render as line breaks, like on GitHub.
Mermaid diagrams render only in document previews.

Japanese text uses bundled Noto Sans JP with no external font service. See the
[font notices and licenses](../src/preview/public/fonts/noto-sans-jp/README.md).
