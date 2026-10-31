# Preview sample data

`scripts/preview_entrypoint.sh` prepares sample data using the existing Sadoku
CLI, exports `SADOKU_SOURCE` and `SADOKU_COMMENTS_DIR`, and executes the command
passed as its arguments with `exec`. It requires `sadoku` on `PATH` and does not
choose a hosting platform, server command, host, or port.

From the repository root, with `sadoku` installed:

```sh
sh scripts/preview_entrypoint.sh \
  sh -c 'exec sadoku start "$SADOKU_SOURCE" --no-open --keep-alive'
```

Each startup creates an isolated `sadoku-preview.*` directory under `/tmp` (or
`TMPDIR`), containing Markdown documents and a dedicated comments directory.
Seed failures stop startup and remove the incomplete data. A command is
required; it receives its arguments unchanged, and its exit status becomes the
launcher's exit status.

Set a nonempty `SADOKU_SOURCE` to skip sample preparation and preserve the
configured `SADOKU_COMMENTS_DIR`. An unset or empty source enables preparation.

All sample Markdown comes from `test/integration/fixtures/`, copied with its
directory structure into the temporary directory. The copies provide five
documents (one deleted) and sixteen comments, including human and bot authors,
replies, review requests, active, stale, and resolved comments, instructions,
memories, and tags.
Seeded comments, replies, instructions, memories, and tag names are in English.

| Fixture                 | Preview state                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `comprehensive.md`      | 27 revisions, eight comments (active, stale, resolved), instructions, and memories |
| `second.md`             | Source diff, moved comment, deleted passage, resolved comment                      |
| `japanese.md`           | Japanese rendering and two comments                                                |
| `guides/overview.md`    | Deleted document with a saved snapshot, comments, and memory                       |
| `guides/setup/local.md` | Nested path and empty comment, instruction, and memory state                       |

Open **Revisions** on `comprehensive.md` to browse the twenty most recent saved
versions. Its history contains the original fixture, 23 numbered review drafts,
the restored fixture, a temporary review note, and the original fixture again as
the current version. Each draft changes the introduction and the text before a
subheading, so selecting an earlier version
shows its changes from the preceding draft. The oldest listed version also has a
predecessor outside the twenty-item list. These snapshots are recorded through
`sadoku comment list` with a comment on the unchanged heading; the remaining
comments are added after the drafts. The temporary review note receives a comment
before it is removed, leaving a stale thread with its saved quote. Open
**Comments** on `comprehensive.md` to compare **All**, **Active**, and **Stale**
filters, then use **Resolved** to see the resolved thread.

The seed script changes the copied `second.md` after adding comments and deletes
the copied `guides/overview.md`. The original fixtures remain available to the
existing integration tests. Tags are created and attached through
`sadoku tag add` and `sadoku document tag add`:

| Tag            | Documents                         |
| -------------- | --------------------------------- |
| `Needs review` | `comprehensive.md`, `second.md`   |
| `Markdown`     | `comprehensive.md`, `japanese.md` |
| `Archived`     | `guides/overview.md` (deleted)    |
| `Unassigned`   | None                              |

`guides/setup/local.md` remains untagged. Use these samples to try tag
filtering, document tag editing, and tag management, including a tag with no
documents. Tags use the CLI's default background color. Display titles remain
unset.

Operation results are stored in the startup's temporary directory. Each launcher
invocation has independent data; separate preview instances do not share
results.
