# Preview sample data

[Back to development](development.md)

## Start a local preview

With `sadoku` installed and on `PATH`, run from the repository root:

```sh
sh scripts/preview_entrypoint.sh \
  sh -c 'exec sadoku start "$SADOKU_SOURCE" --no-open --keep-alive'
```

The launcher prepares samples through the Sadoku CLI, exports `SADOKU_SOURCE`
and `SADOKU_COMMENTS_DIR`, and executes the supplied command. It does not choose
a hosting platform, server command, host, or port. A command is required; its
arguments and exit status pass through unchanged.

Each startup creates an isolated `sadoku-preview.*` directory under `TMPDIR`
(or `/tmp`) for documents, comments, and operation results. Seed failures stop
startup and remove incomplete data. Separate launches do not share data.

Set a nonempty `SADOKU_SOURCE` to skip preparation and preserve the configured
`SADOKU_COMMENTS_DIR`. An unset or empty source enables preparation.

## Sample contents

The seed script copies Markdown from `src/server/test/integration/fixtures/`
with its directory structure intact. Original fixtures are unchanged. Samples
include deleted documents, human and bot comments, replies, review requests,
instructions, memories, and tags. Review text and tag names are in English.

| Document | Examples to try |
| --- | --- |
| `comprehensive.md` | Revision history; active, stale, and resolved comment filters; instructions and memories |
| `second.md` | Changes across paragraphs, tables, code, and Mermaid; overlapping, moved, deleted, and resolved comments |
| `japanese.md` | Japanese rendering and comments |
| `guides/overview.md` | Deleted document with a saved snapshot, comments, and memory |
| `guides/setup/local.md` | Nested path with no comments, instructions, memories, or previous snapshot |

Use **Changes** on `second.md` to explore prose and block differences, including
overlapping comment ranges. `comprehensive.md` has enough history to exercise the
revision list limit. Tags cover active, archived, and unassigned cases; the
nested document is untagged and has no previous snapshot.

Restart the launcher with `SADOKU_SOURCE` unset to regenerate samples.

For hosted previews and their instance lifecycle, see
[PR previews](pr-preview.md).
