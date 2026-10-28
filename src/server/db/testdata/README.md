# Legacy SQLite fixture

`wasm.sqlite3.gz` was written using `github.com/ncruces/go-sqlite3 v0.30.3`
(SQLite 3.51.1), the driver used before the CGO migration. The database was
created with `src/server/db/database.go` and the immutable migrations from
commit `500a35ad21384c01ad34f7a811b56f391823f514`, then compressed with gzip.
It has all 12 applied migration records and a document with a comment, reply,
revision, instruction, memory, and tag. All timestamps are
`2026-10-28T00:00:00.000Z`; its Unicode text is checked by
`TestOpenDatabaseWrittenByWasmDriver`.

Keep this fixture as an actual old-driver database. Do not regenerate it using
the current driver: that would stop testing cross-driver file compatibility.
