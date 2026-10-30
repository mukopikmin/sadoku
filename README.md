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
- Use **Zoom** on a Mermaid diagram to enlarge it. Use the **+** and **−**
  buttons or pinch to zoom, scroll to move, and choose **Fit to view** to reset.
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
[GitHub export details](docs/github-comment-export.md) for update behavior and
other limitations.

## CLI and coding agents

You can also manage comments from the terminal:

```sh
sadoku comment add --source README.md --ensure-document --start-line 10 --body "Check this line."
sadoku comment list --source README.md
sadoku comment resolve <comment-id> --source README.md
```

Create and register a file in an existing directory (`--title` is optional):

```sh
sadoku document add docs/notes.md --create --title "Notes"
```

Existing files are never overwritten; missing extensions default to `.md`. The
file starts empty; `--title` sets its display title in Sadoku. You can also use
`--title` without `--create` when registering an existing file.

Manage tags independently of documents:

```sh
sadoku tag add --name "Needs review"
sadoku tag list
sadoku tag delete <tag-id>
```

Tag creation and listing return JSON. Each listed tag includes its document
count. New tags are not attached to any document; names must be unique. Tags
created through the CLI always use the default background color (`#718096`).
Deleting a tag also removes it from every document without deleting the
documents.

Attach or detach existing tags from a registered document:

```sh
sadoku document tag add 3 5 --source README.md
sadoku document tag delete 3 --document 1
sadoku document inspect 1
sadoku document list
```

Use exactly one of `--document <id>` or `--source <file.md|url>` for tag
associations. Both the document and tag IDs must already exist. Adding an
attached tag or removing an unattached tag succeeds without changing other
associations; removal preserves the tag itself. Each command applies all
requested changes atomically, with at most 20 tags per document.

Tag association commands return the resulting tag array as JSON. Document
listing and inspection include `tags`, containing each tag's `id`, `name`, and
`backgroundColor`, or an empty array when no tags are attached. Colors are
read-only through the CLI.

Use `sadoku --help` for document, tag, comment, instruction, and memory
commands. Instructions provide guidance for agents; memories provide
document-specific background context and are added and updated through the CLI.

Global instructions apply to all documents sharing the same `sadoku.sqlite3`,
including local files, URLs, and GitHub PR files. Manage them under
**Global instructions** in the application header, or through the CLI without
registering a document:

```sh
sadoku instruction list --global
sadoku instruction add --global --content "Keep explanations concise."
sadoku instruction update <instruction-id> --global --content "Use concrete examples."
sadoku instruction delete <instruction-id> --global
```

Choose exactly one of `--global`, `--document <id>`, or `--source <file.md|url>`.
Global listing returns `{ "instructions": [...] }` without a document; entries
have `id`, `content`, `createdAt`, and `updatedAt`. Existing document-specific
commands and output remain unchanged. Global instructions are stored separately
and survive document deletion.

The document instructions dialog shows both global guidance and instructions
for that document. Choose **Manage global instructions** there to open the same
management dialog. Apply both; document instructions take precedence when they
directly conflict with global instructions. Agents must retrieve both scopes;
Sadoku does not inject instructions into unrelated agent sessions. The
`sadoku-review` skill retrieves global instructions at the start of a review.

For compatible coding agents, install the `sadoku-review` skill with
[Agent Package Manager](https://github.com/microsoft/apm):

```sh
apm install mukopikmin/sadoku --skill sadoku-review
```

The skill requires `sadoku` on `PATH`.

## Stable releases

Use `.agents/skills/sadoku-release/SKILL.md` to approve the version, exact
tested `main` commit, notes range, and omitted pull requests. Record the
approved comparison tag in the annotated release tag's `Previous-Stable-Tag`
trailer:

```sh
git tag --annotate v<version> <approved-full-sha> \
  --message "Release v<version>" \
  --message "Previous-Stable-Tag: <approved-comparison-tag>"
```

Pushing that tag starts the Release workflow: validation, the reusable Test
workflow on the tagged commit, builds, attestation, notes, and publication.
The workflow reads the approved baseline from the annotated tag and compares it
with a fresh GitHub lookup. Missing, duplicate, or invalid trailers fail.

For a confirmed first release, use `release-notes-baseline` at the repository
root. An empty stable-release lookup with other stable version tags on the
remote fails instead of implying a first release. Drafts, prereleases, and
nightly releases are excluded from the notes baseline. Validation requires the
current `main` tip and an increasing version. After validation, the source commit
is fixed for testing and building; later `main` updates do not change the release.

Test and build jobs have read-only repository permissions and do not persist
checkout credentials. A separate publish job downloads the build's immutable
artifact by ID, attests the archives for consumers, generates notes, and creates
the release. It does not check out or execute repository code. Before publishing,
the approved baseline must still be the latest stable release, and both tag
objects must be unchanged. This also prevents an old failed run from superseding
a newer release when retried.
Existing releases fail creation; no assets are overwritten. Failed runs leave
tags intact; never move or recreate a stable tag. Repository rules should restrict
stable tag creation and prevent updates or deletion, including the comparison
baseline. Tag rules enforce who can start publication: a tag push loads its
workflow from the tagged revision, so workflow checks alone cannot police a
tag creator who can replace that workflow.

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
[font notices and licenses](src/preview/public/fonts/noto-sans-jp/README.md).

## Development

Use GNU Make as the entry point for repository tasks. Go 1.26.10 or later runs
the backend, CLI, build, and notice tools. Release validation and notes run in
GitHub Actions using Bash, Git, GitHub CLI, and jq. Node.js runs the preview
client and npm tooling; its required version is specified in `package.json`.

SQLite uses `mattn/go-sqlite3` with CGO enabled. Building from source requires
a C compiler: GCC and libc development headers on Linux, Xcode Command Line
Tools on macOS, or MinGW-w64 GCC on Windows. Make enables CGO for backend tasks.
Downloaded release binaries include SQLite and do not require a C compiler or
a separate SQLite installation.

```sh
make deps
make start ARGS=README.md
```

`package.json` contains npm and Node tasks only. Make invokes those scripts and
coordinates Go and generated-code tasks:

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

See [contributor guidelines](AGENTS.md), [proxy setup](proxy/README.md), and the
[release workflow guide](.agents/skills/sadoku-release/SKILL.md) for details.
