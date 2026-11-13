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
`--title` without `--create` when registering an existing file. `add` rejects
already registered documents; use `update` to change their attributes.

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

Set a registered document's title and complete tag collection:

```sh
sadoku document update 1 --title "Review notes" --tags 3,5
sadoku document update 1 --tags ""
sadoku document update 1 --title ""
sadoku document inspect 1
sadoku document list
```

Omitted attributes are unchanged. An empty title clears the display title; an
empty tag collection removes all tag associations. `--tags` replaces the entire
collection with existing tag IDs, up to 20 distinct tags. Repeated IDs count once.
Title and tag changes are saved atomically. Tag definitions are managed separately
with `tag add/list/delete`; replacing associations does not delete tags.

`document add` also accepts `--tags` to set initial associations. `document update`
returns the updated document, including its tags, as JSON. Document listing and
inspection also include `tags`, containing each tag's `id`, `name`, and
`backgroundColor`, or an empty array when no tags are attached. Colors are
read-only through the CLI. The former `document tag add/delete` commands have
been replaced by `document update --tags`.

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
Sadoku does not inject instructions into unrelated agent sessions. All three
skills below retrieve both instruction scopes and document memories before
working on a target. Instructions guide the work; memories provide background
and earlier decision rationale that agents verify against current evidence.
Current user requests and applicable project instructions take precedence over
Sadoku instructions; memories do not override either. Empty settings are valid,
but retrieval failures must be resolved before proceeding with unknown guidance
or context. Initial setup uses this context to prepare writing guidance, review
uses it to choose review criteria, and comment responses use it to interpret
feedback and check proposed changes.

For compatible coding agents, install the skills with
[Agent Package Manager](https://github.com/microsoft/apm). Each requires
`sadoku` on `PATH`.

| Workflow | Skill | Behavior |
| --- | --- | --- |
| Initialize a document | `sadoku-init` | Establish the filename and title, create and register the document, and save writing guidance and optional memories before drafting. |
| AI reviews and comments | `sadoku-review` | Read an existing document and post AI-authored findings without editing the body. |
| AI acts on human comments | `sadoku-address-comments` | Apply human feedback, including human replies to AI findings, and reply for human confirmation. |

```sh
apm install mukopikmin/sadoku --skill sadoku-init
apm install mukopikmin/sadoku --skill sadoku-review
apm install mukopikmin/sadoku --skill sadoku-address-comments
```

The comment-response skill leaves threads unresolved for human confirmation and
checks for useful document memories after the work. The review skill derives its
criteria from the user's request and both instruction scopes, and uses verified
memories to account for background and earlier decisions. It leaves findings as
open comments for human consideration.

**Breaking change in skills package 0.4.0:** `sadoku-review` now means AI review
and comment creation. Existing prompts that use it to apply feedback should use
`sadoku-address-comments`; document creation should use `sadoku-init`.
