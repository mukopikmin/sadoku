# mdview

`mdview` is a small CLI for previewing one Markdown file in your browser.

Pass it a Markdown file path. It starts a local HTTP server, renders the file as
HTML, prints the preview URL, and opens that URL in your default browser.

## Usage

```sh
mdview <file.md> [options]
```

Preview a file:

```sh
mdview README.md
```

Use a different port:

```sh
mdview README.md --port 4000
```

Bind to a specific host and port:

```sh
mdview README.md --host 127.0.0.1 --port 4000
```

Print the URL without opening a browser:

```sh
mdview README.md --no-open
```

Keep the server running after the preview tab is closed:

```sh
mdview README.md --keep-alive
```

By default, the server reads the Markdown file again on each request, so
refreshing the page shows recent edits. The browser preview also reloads
automatically when the Markdown file changes.

By default, the server stops after the browser tab is closed. Use `--keep-alive`
when you want to leave the server running.

## Options

| Option              | Description                                                | Default                |
| ------------------- | ---------------------------------------------------------- | ---------------------- |
| `-p, --port <port>` | Port to bind. Must be between `1` and `65535`.             | `3334`                 |
| `--host <host>`     | Hostname or IP address to bind.                            | `127.0.0.1`            |
| `--no-open`         | Do not open the preview URL in your browser automatically. | Opens browser          |
| `--keep-alive`      | Keep the server running after the browser tab is closed.   | Stops after tab closes |
| `-v, --version`     | Print the CLI version.                                     |                        |
| `-h, --help`        | Print command help.                                        |                        |

## Browser Opening

`mdview` opens the preview with the platform default opener:

- macOS: `open`
- Windows: `cmd /c start`
- Linux: `xdg-open`

Set `BROWSER` to choose the opener command explicitly. If the command contains
`%s`, `mdview` replaces it with the preview URL. Otherwise, the URL is appended
as the last argument.

```sh
BROWSER=explorer.exe mdview README.md
BROWSER='chrome.exe --new-window %s' mdview README.md
```

## Development

Install dependencies:

```sh
npm install
```

Run the CLI with Deno:

```sh
deno task start README.md
```

Compile a standalone binary:

```sh
deno task compile
./mdview README.md
```

On macOS, build in a temporary directory and install the binary to
`$HOME/.local/bin/mdview`:

```sh
deno task install:mac
```

## Supported Markdown

| Feature                                            | Status        | Notes                                                              |
| -------------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| Headings and paragraphs                            | Supported     | Rendered through the React preview client.                         |
| Bold and italic emphasis                           | Supported     | `**bold**` and `_italic_` render as emphasis.                      |
| Unordered, ordered, and nested lists               | Supported     | Nested unordered and ordered lists are preserved.                  |
| Blockquotes and horizontal rules                   | Supported     | Standard quote blocks and thematic breaks render normally.         |
| Links and images                                   | Supported     | Link and image titles are preserved.                               |
| Reference-style links and images                   | Supported     | Link definitions such as `[id]: https://example.com` are resolved. |
| Inline code, indented code, and fenced code blocks | Supported     | Code content is escaped by default.                                |
| Hard line breaks                                   | Supported     | Standard Markdown hard breaks render as line breaks.               |
| Backslash escapes and HTML entities                | Supported     | Markdown escapes and entities are handled by the Markdown parser.  |
| Heading anchor links                               | Supported     | Headings get stable `id` attributes and clickable anchors.         |
| Plain URL autolinks                                | Supported     | Plain URLs are converted to links.                                 |
| Task list checkboxes                               | Supported     | `- [ ]` and `- [x]` render as disabled checkboxes.                 |
| Strikethrough                                      | Supported     | `~~deleted~~` renders as deleted text.                             |
| GitHub-style tables                                | Supported     | Table alignment markers are preserved.                             |
| Syntax highlighting                                | Supported     | Common code fence languages are highlighted with highlight.js.     |
| Mermaid diagrams                                   | Supported     | Fenced `mermaid` code blocks render from local preview assets.     |
| Raw HTML                                           | Not supported | Raw HTML is escaped for safer previews.                            |
| Footnotes                                          | Not supported | No footnote plugin is enabled.                                     |
| Definition lists                                   | Not supported | No definition list plugin is enabled.                              |
| Math or LaTeX                                      | Not supported | Math rendering is not bundled.                                     |
| Front matter                                       | Not supported | YAML front matter is rendered as Markdown text.                    |
| Generated table of contents                        | Not supported | Heading anchors are generated, but no TOC is built.                |
