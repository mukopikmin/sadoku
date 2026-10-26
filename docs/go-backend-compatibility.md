# Go backend compatibility checks

The reference implementation is commit
`368b47eb1ae18a84d428ce4367d25cb815584968`, the final TypeScript backend before
the Go migration.

## Recorded response comparison

`src/server/http/testdata/legacy_http.json` contains responses captured by
running the reference handler with SQLite storage. The Go test replays the same
requests, file edits, deletions, settings, and initial data against the
production Go handler. It requires transcripts for every method declared in
`PreviewService`.

| Session             | HTTP requests | Checked behavior                                                                                                                                                               |
| ------------------- | ------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local directory RPC |           124 | All 32 RPC methods, resource isolation, creation, titles, revisions/restoration, comments/replies/resolution/rebasing, tags, notes, settings, and transport validation         |
| REST                |            87 | Read/write/delete routes, partial tag updates, numeric representations and resource IDs, ignored fields, validation errors, deleted sources, response fields, and status codes |
| GitHub PR RPC       |            20 | Document IDs/counts, escaped filenames, canonical comment identities, immutable source URLs, pending-review export, stale heads, titles, and unavailable local capabilities    |
| Total               |           231 | Response bodies, statuses, content types, and cache policy                                                                                                                     |

JSON object key order is ignored; field presence, values, types, and array order
are compared. Temporary filesystem roots, timestamp fields, and physical SQLite
file size are normalized. Dynamic responses retain `Cache-Control: no-store`,
including errors where the reference implementation omitted that header.

The two accepted improvements below have explicit `acceptedDifference` and
`goExpected` entries alongside the original recorded response. Other recorded
responses are compared directly.

## Additional regression coverage

- The CLI suite compares 178 captured command transcripts, including stdout,
  stderr, and exit status. Startup and update messages have separate tests.
- Configuration reading compares 32 recorded TOML cases, including integral
  floats, absent/default settings, invalid values/types, and exact diagnostics.
  Missing-HOME tests verify config-save failure and the working-directory
  fallback for comments.
- Directory preparation compares registration IDs and displayed order for 21
  recorded filenames, including case, accents, punctuation, supplementary
  Unicode, and nested paths, before and after creation. Separate coverage checks
  that file limits select from native filesystem order before sorting.
- Source resolution compares 33 recorded URL cases: host/default-port/IDNA
  normalization, escaped paths and dot segments, IPv4/IPv6, query/fragment
  removal, remote document titles, and GitHub pull recognition/identities. The
  WHATWG parser preserves the JavaScript URL rules used by existing databases.
- Markdown reading compares 31 recorded results across local/remote UTF-8
  decoding (including BOM and malformed bytes), HTTP success/error statuses,
  redirect chains through the legacy 20-hop limit, and URL credentials.
  Transport failures and cancellation have separate tests.
- GitHub preparation compares 21 recorded adapter scenarios, including command
  diagnostics, missing/malformed metadata, file-list failures, pagination, and
  stopping at the configured file limit. Separate regressions check missing
  `gh`, response decoding, and stopping diff pagination once a file is found.
- Filesystem/SSE tests cover same-size/mtime writes, atomic replacement,
  deletion/recreation, unrelated files, other CLI processes, and subscribers.
- Startup tests cover blocked discovery/registration/remote reads, progress,
  cancellation, snapshot errors, and concurrent first-document reads.
- GitHub export compares 15 recorded scenarios for encoded pull URLs, Unicode
  marker keys, pending-comment separators/replies, submitted-comment reuse,
  missing metadata, and null GraphQL data. Mutation variables and counts are
  compared as well as returned results and error codes.
- Creation/restoration transcripts cover missing/invalid parent directories,
  occupied names and symlinks, clearing titles on recreated documents, malformed
  UTF-8 archival, and revision validation before unsafe-path errors. Symlink
  scenarios skip when the operating system does not permit creating links.
- Concurrent restore requests report busy immediately. Slow Markdown reads and
  GitHub export allow other document reads/local edits to proceed; export
  rechecks local state and the current session target before mutating GitHub.
- GitHub export tests cover restart/idempotency, other reviewers, pagination,
  replies, changed remote state, malformed responses, diff hunks, concurrent
  exports, and mutation failures without retries. The monitor test verifies
  unchanged heads, error recovery, added/removed files, and invalidation using
  virtual time, with one head request per poll.
- Server startup continues past 100 occupied ports. Comment rebasing retains
  distant moved ranges in documents above the former 16-million-cell cutoff.
- Storage/configuration tests cover migrations and checksums, rollback, scoped
  resources, bounded revision reads, unchanged tag timestamps, preserved
  malformed configuration, and file creation followed by a registration failure.
- Both Connect JSON and binary protobuf are exercised. GitHub responses are
  provided by local fake `gh` commands; tests do not contact GitHub or open a
  browser.

## Accepted differences

- Shutdown after the last event stream disconnects waits three seconds.
- Some unknown REST subpaths return 405 instead of 404.
- Remote Markdown fetching has a 30-second timeout and a 32 MiB limit.
- Deleting a displayed source can still show its saved snapshot, instead of
  returning the reference implementation's 500 error.
- A failed tag replacement rolls back newly created tags as well as links,
  instead of leaving orphan tags after the failure.

The checks cover these recorded scenarios and the regression suites. They do not
assert equivalence for every possible input or scheduling interleaving.

Run `npm run build:client` before `npm run test:server`. The full required
checks are defined in `.github/workflows/test.yml`.
