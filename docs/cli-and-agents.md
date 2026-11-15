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

Tags are shared across documents and have unique names. New tags are unattached;
deleting a tag removes its associations without deleting documents. Colors are
read-only through the CLI.

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

`document add` also accepts `--tags`. Tag creation and listing, plus document
update, listing, and inspection return JSON, including associated tags where applicable.

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
Each scope stores one instruction text. `get` returns `{ "content": "..." }`,
with an empty string when unset. `set` replaces the text and returns the same
shape; `--content ""` clears it. Missing or whitespace-only content is invalid.
Memories hold multiple entries of document-specific background.

Agents retrieve both instruction scopes and document memories before working.
Current user requests and applicable project instructions take precedence over
Sadoku instructions; document instructions override conflicting global guidance.
Memories provide background to verify against current evidence and do not
override instructions. Empty values are valid, but retrieval failures must be
resolved before proceeding. Sadoku does not inject this context into unrelated
agent sessions.

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

Review findings and comment-response threads remain open for human confirmation.
The comment-response skill also checks for useful document memories after work.
