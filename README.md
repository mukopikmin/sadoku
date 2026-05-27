# mdview

Preview one Markdown file through a local HTTP server.

## Usage

```sh
deno task start README.md
```

Or compile a standalone binary:

```sh
npm install
deno task compile
./mdview README.md
```

If you already have a compiled binary on your `PATH`:

```sh
mdview README.md
```

Options:

```sh
mdview README.md --port 4000 --host 127.0.0.1
```

Open the printed URL in your browser. The server reads the Markdown file on each request, so refreshing the page shows recent edits.

## Supported Markdown

- headings, paragraphs, lists, blockquotes, links, images, inline code, and fenced code blocks
- GitHub-style tables
- Mermaid diagrams through fenced `mermaid` code blocks

Example:

````md
| Name | Count |
| ---- | ----: |
| alpha | 1 |

```mermaid
graph TD
  A --> B
```
````

Mermaid rendering is served from vendored local assets when a page contains a Mermaid block.

The vendored Mermaid assets are generated from the npm dependency and are not meant to be edited by hand:

```sh
npm install
deno task vendor:mermaid
```
