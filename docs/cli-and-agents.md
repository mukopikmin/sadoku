# CLI and coding agents

[Back to README](../README.md)

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
sadoku instruction get --global
sadoku instruction set --global --content "Keep explanations concise."
sadoku instruction set --global --content ""
sadoku instruction set --source document.md --content "Use concrete examples."
```

Choose exactly one of `--global`, `--document <id>`, or `--source <file.md|url>`.
Each scope stores a single instruction text: one shared value for the database
and one value per document. `get` and `set` return `{ "content": "..." }`;
an unset value is an empty string. `set` replaces the whole text, and setting an
explicitly empty string (`--content ""`) clears it. Omitting `--content` or
providing only whitespace is an error. In the UI, edit the text and save;
leave it empty and save to clear it.

Existing databases automatically merge multiple instructions within each scope
in ID order, separated by blank lines. Instruction commands are `get` and `set`;
instruction IDs are not accepted.
Use `set` to explicitly replace the complete text; there is no append operation.
The existing API response shapes remain available for compatibility. Global
instructions remain separate from document instructions and memories. Memories
continue to support multiple entries.

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
