# Legacy HTTP fixtures

`legacy_http.json` records responses captured from the final TypeScript backend,
commit `368b47eb1ae18a84d428ce4367d25cb815584968`, using SQLite storage.
`../compatibility_test.go` replays the requests and filesystem changes against
the production Go handler with isolated storage and a local fake GitHub CLI.
The reference backend is not required to run the tests.

The fixture covers local directory RPC, REST, and GitHub PR RPC sessions.
The harness requires transcripts for legacy `PreviewService` methods; RPCs added
after capture have explicit exclusions and separate behavioral tests. Preserve
the original captures rather than fabricating legacy responses for new behavior.

Comparisons check status, content type, JSON field presence, values, types, and
array order. JSON object key order is ignored. Temporary roots, timestamp fields,
and physical SQLite file size are normalized. All dynamic responses must use
`Cache-Control: no-store`, including errors where the legacy server omitted it.

Two intentional response changes use `acceptedDifference` and `goExpected`
alongside the original response, with an explicit allowlist in the harness:

- `deleted-live-snapshot`: a deleted source can display its saved snapshot
  instead of returning the legacy 500 error.
- `tag-replacement-rollback`: a failed replacement rolls back new tags as well
  as their links, avoiding orphan tags.

Other migration differences are a three-second shutdown delay after the last
event stream disconnects, 405 rather than 404 for some unknown REST subpaths,
and a 30-second timeout and 32 MiB limit for remote Markdown fetches. The
transcripts establish compatibility for recorded cases, not every possible
input or scheduling interleaving.

Run `make test-server` from the repository root; it builds client assets first.
