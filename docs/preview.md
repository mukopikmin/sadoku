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
include five documents (one deleted), twenty-one comments, human and bot authors,
replies, review requests, instructions, memories, and tags. Seeded review text
and tag names are in English. Long document and global instructions exercise
bounded text scrolling and instruction editing in the guidance dialogs.

| Document | Examples to try |
| --- | --- |
| `comprehensive.md` | Revision history; active, stale, and resolved comment filters; instructions and memories |
| `second.md` | Changes across paragraphs, tables, code, and Mermaid; overlapping, moved, deleted, and resolved comments |
| `japanese.md` | Japanese rendering and comments |
| `guides/overview.md` | Deleted document with a saved snapshot, comments, and memory |
| `guides/setup/local.md` | Nested path with no comments, instructions, memories, or previous snapshot |

`comprehensive.md` has 27 saved revisions, allowing the twenty-item revision list
to be exercised with an older predecessor outside the list. On `second.md`,
toggle **Changes** to compare API-key access with OAuth and inspect comments over
the diff. Range comments cover consecutive paragraphs, the table and code, and
review notes spanning a deletion. A partially overlapping range extends from the
table through the Mermaid diagram. Check that shared blocks have one highlight,
removed content splits the outline, and selecting the code block takes priority
inside the overlap. Click a range’s first paragraph, then Shift-click its last
block; toggle **Changes** to check that selection persists. Both overlapping
threads remain available at their code and diagram endpoints.

`guides/setup/local.md` has no **Changes** option because it has no
previous snapshot.

For a minimal character-level comparison, open `second.md`, enable **Changes**,
and find **Inline Diff Check**. Only `30` (removed) and `45` (added) should be
highlighted in “The request timeout is 30 seconds.” The surrounding words and
the following paragraph should appear once without a diff background. Restart
the sample launcher with `SADOKU_SOURCE` unset to regenerate existing samples.

Tags include `Needs review`, `Markdown`, `Archived` (on the deleted document),
and `Unassigned` (with no documents). The nested document remains untagged.
These cover filtering, document tag editing, and tag management. Tag colors use
the CLI default, and display titles remain unset.

For hosted previews and their instance lifecycle, see
[Cloud Run previews](cloud-run-preview.md).
