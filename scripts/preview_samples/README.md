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

The samples include seven documents (one deleted), fifteen comments, human and
bot authors, replies, review requests, resolved comments, instructions, and
memories. The seed script changes a document after adding comments and deletes
another, so source diffs, moved comments, deleted passages, and saved document
snapshots can be inspected without editing files. Markdown and Japanese
rendering examples are copied from the integration fixtures. Tags and display
titles are left unset because the existing CLI does not configure them.

Operation results are stored in the startup's temporary directory. Each launcher
invocation has independent data; separate preview instances do not share
results.
