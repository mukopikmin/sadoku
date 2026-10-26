# Preview RPC response mappings

The Go handlers in `src/server/http/api/preview_rpc.go` implement the generated
Connect service interface and share application operations with REST adapters.
The boundary in `src/server/http/api/rpc.go` uses Protobuf JSON conversion to
map requests into application inputs and application results into generated Go
response messages. It does not call REST endpoints or round-trip HTTP responses.

The response schema determines which fields are public. Unknown application
fields are discarded when creating generated messages: `Tag` omits storage
timestamps and `Instruction` omits `documentId`, while `TagSummary` retains its
timestamps and document count. REST responses keep numeric IDs. Connect JSON
represents `uint64` IDs as strings, which the generated browser client converts
to `bigint`; the Go handlers also support the binary Protobuf codec.

Generated messages define field names and scalar representations, but
application validation remains necessary:

- Proto3 supplies zero, false, empty strings, and empty repeated fields when a
  nonoptional field is omitted. Request validation still checks positive comment
  ranges, nonblank contents, settings choices, GitHub revision strings, and IDs
  within the supported storage range.
- Optional fields preserve presence. Pointer fields distinguish absence from an
  explicitly present zero, false, or empty string. A missing optional
  `githubHeadSha` remains absent; a missing nonoptional `fileUrl` defaults to an
  empty string in the browser client.
- An omitted resolution bool means reopen. Omitted required settings values or
  instruction content remain invalid. Both nonoptional strings in `UpdateTag`
  must be valid; REST tag updates continue to support partial patches.
- Dynamic responses and errors use `Cache-Control: no-store`. Successful REST
  deletes without an updated resource return `204 No Content`.

Go adapter and integration tests use the official Connect client with JSON and
binary Protobuf, and make REST requests against the Go server. They cover
persistence, nested replies, optional fields, document isolation, revision
restoration, validation, cache behavior, and event streams. GitHub export tests
use a local fake GitHub CLI and verify that exports create pending reviews
without submitting them.
