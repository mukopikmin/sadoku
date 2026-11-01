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
migration and its ledger insert in one transaction, and checks all foreign keys
before committing. It restores the original foreign-key setting after success or
failure. A failed migration rolls back its schema, copied data, and ledger entry;
earlier completed migrations remain applied. Reopening retries unapplied
migrations. Do not run migrations concurrently with application writes.

## Strict comment metadata (0015)

`comment.source_text` and `comment.source_hash` are required. Unresolved comments
must have no resolver or resolution timestamp; resolved comments require both.
The migration rejects incompatible data rather than inventing missing history.
Back up the database before operator repairs, with the application stopped.
Find affected records using:

```sql
SELECT id, document_id, local_id, source_text, source_hash,
       resolved, resolved_at, resolved_by_type
FROM comment
WHERE source_text IS NULL OR source_hash IS NULL
   OR (resolved = 0 AND (resolved_at IS NOT NULL OR resolved_by_type IS NOT NULL))
   OR (resolved = 1 AND (resolved_at IS NULL OR resolved_by_type IS NULL));
```

Restore missing values from trusted historical records. The source hash uses
`usecase.HashSource`, FNV-1a over UTF-16 code units, rather than UTF-8 bytes. Do not
substitute the current document text for an unknown original or invent a resolver
or timestamp. If trusted records are unavailable, keep the original database and
use the previous application version until the records can be restored. After
repair, reopen with the new version to retry migration 0015.

## Reproducibility

Run `make deps`, `make check-go-format`, `make vet`, and `make test-server`.
The database tests cover fresh-versus-upgraded schema equality, reopening and
reapplying migrations, original checksums, preservation of comment/reply IDs,
constraints and cascade behavior, foreign-key validation, rollback, and retry
following an explicit operator repair. The old WASM fixture stays unchanged; its
incomplete metadata is intentionally rejected before a test-only repair.
