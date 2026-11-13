# Database migrations

`legacy.json` is immutable migration history from the original server. Add new
migrations to `current.json`; never edit applied statements or checksums.
Checksums are `sha256:` followed by the lowercase SHA-256 digest of the statements
joined with `;\n` (no final separator). Versions are unique and listed in order.

When SQLite cannot express a required constraint with ALTER TABLE, set `rebuild`
to true and use explicit statements to create a replacement table, copy named
columns including IDs, drop the original, rename the replacement to the original
name, and recreate its indexes. Include every existing constraint and default.
Do not rename the original table first: SQLite may rewrite child references.

The runner pins one connection, disables foreign keys before BEGIN, executes the
pending migrations and their ledger inserts in one transaction, and checks all foreign keys
before committing. It restores the original foreign-key setting after success or
failure. A failed upgrade rolls back all pending schema changes, copied data, and ledger
entries; migrations applied before the upgrade remain applied. Reopening retries unapplied
migrations. Do not run migrations concurrently with application writes.

## Strict comment metadata (0016)

`comment.source_text` and `comment.source_hash` are required. Unresolved comments
must have no resolver or resolution timestamp; resolved comments require both.
Missing source text/hash values are copied as empty strings using COALESCE;
existing non-NULL values are preserved. An empty hash cannot match a computed
source hash, so fallback source matching marks the comment stale. This differs
from actual empty source text, whose computed hash is `811c9dc5`. Snapshot-based
line mapping remains available when a snapshot exists. No runtime changes or
additional status column are required.

Inconsistent resolution metadata still fails migration.
Back up the database before operator repairs, with the application stopped.
Find affected records using:

```sql
SELECT id, document_id, local_id, source_text, source_hash,
       resolved, resolved_at, resolved_by_type
FROM comment
WHERE (resolved = 0 AND (resolved_at IS NOT NULL OR resolved_by_type IS NOT NULL))
   OR (resolved = 1 AND (resolved_at IS NULL OR resolved_by_type IS NULL));
```

Restore resolution metadata from trusted historical records. The source hash uses
`usecase.HashSource`, FNV-1a over UTF-16 code units, rather than UTF-8 bytes. Do not
substitute the current document text for an unknown original or invent a resolver
or timestamp. If trusted records are unavailable, keep the original database and
use the previous application version until the records can be restored. After
repair, reopen with the new version to retry migration 0016.

## Reproducibility

From the repository root, run `make deps` once, then `make test-migrations`.
This runs the database suite with the race detector, including
`TestOpenRetriesLegacyResolutionFailureWithoutRecreatingDatabase`.
The test creates a temporary legacy database and covers five inconsistent
resolution states accepted by that schema. Each case fails startup twice at
0016, verifies unchanged schema, comments, replies, and migration history, then
restores the fixture's known original resolution state and successfully reopens
twice without recreating the database. The normal server CI suite runs this test
as well. No user database is accessed.

These cases reproduce known failure conditions, not a confirmed diagnosis of a
particular incident. Preserve the original error and a sanitized database fixture
when available to add an incident-specific regression test. The fixture repair
is not a general repair policy for production data.

Run `make deps`, `make check-go-format`, `make vet`, and `make test-server`.
The database tests cover fresh-versus-upgraded schema equality, reopening and
reapplying migrations, original checksums, preservation of comment/reply IDs,
constraints and cascade behavior, foreign-key validation, rollback, and retry
following an explicit operator repair. The old WASM fixture stays unchanged; its
missing source metadata is backfilled without operator repair.

## Normalized table layouts (0018)

Table identities and manual widths move from the 0017 JSON state into
`markdown_table_layout` and `markdown_table_column_width`. Zero widths become
absent rows (automatic sizing). The comparison Markdown reuses an identical
revision belonging to the document, or records the supplied historical snapshot
when none exists. `comment_document.table_layout_revision_id` tracks that
comparison independently of comment revision references; existing comment
references and revision IDs remain unchanged. All changes commit together.

0017 permitted any valid JSON. 0018 rejects missing or incorrectly typed snapshot,
table, or width metadata, invalid ranges/counts/widths, and duplicate table IDs.
It does not invent missing historical Markdown or identifiers. On failure, the
transaction leaves the original JSON and migration history intact. With the app
stopped, back up the database, inspect the affected `document_table_layout.state`
rows, and repair them only using trusted saved metadata; then reopen to retry.
If the required information is unavailable, retain the database and use the
previous version until it can be recovered. Do not substitute the current file
for an unknown comparison snapshot or delete the database to bypass migration.
