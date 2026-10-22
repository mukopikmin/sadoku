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
documents (one deleted) and fifteen comments, including human and bot authors,
replies, review requests, resolved comments, instructions, and memories.

| Fixture                 | Preview state                                                  |
| ----------------------- | -------------------------------------------------------------- |
| `comprehensive.md`      | Markdown rendering, seven comments, instructions, and memories |
| `second.md`             | Source diff, moved comment, deleted passage, resolved comment  |
| `japanese.md`           | Japanese rendering and two comments                            |
| `guides/overview.md`    | Deleted document with a saved snapshot, comments, and memory   |
| `guides/setup/local.md` | Nested path and empty comment, instruction, and memory state   |

The seed script changes the copied `second.md` after adding comments and deletes
the copied `guides/overview.md`. The original fixtures remain available to the
existing integration tests. Tags and display titles are left unset because the
existing CLI does not configure them.

Operation results are stored in the startup's temporary directory. Each launcher
invocation has independent data; separate preview instances do not share
results.
