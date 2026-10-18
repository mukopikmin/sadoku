# Preview RPC response mappings

Preview RPC adapters call typed use cases and share dependency construction with
REST adapters. They do not round-trip application results through HTTP JSON.
`src/server/api/preview_messages.ts` selects public fields using generated
`MessageInitShape` types; response envelopes in `preview_rpc_api.ts` use
`satisfies` with each method's generated output type. Do not spread storage
objects into these messages. `Tag` omits storage timestamps and `Instruction`
omits `documentId`; `TagSummary` retains its timestamps and document count. REST
payloads retain their existing fields and numeric IDs.

Generated types enforce field names and scalar representations (including
`bigint` for `uint64`), but do not enforce all semantics:

- Init shapes permit omitted scalar fields. Proto3 supplies zero, false, or an
  empty string; repeated fields become empty lists. Select intended response
  fields explicitly so accidental omission does not silently change a result.
- Optional fields preserve presence. Use `undefined` for absence and retain
  explicitly present false, zero, and empty strings. In particular, a reply's
  absent `reviewRequested` differs from `false`. A deleted document's absent
  nonoptional `fileUrl` becomes an empty string, while an absent optional
  `githubHeadSha` remains undefined.
- A JavaScript number is not necessarily a valid storage ID or Protobuf integer.
  Response `uint64` conversions reject negative, fractional, nonfinite, and
  unsafe numbers before conversion to `bigint`. Document requests outside the
  positive safe integer range remain not found.
- Request types do not validate positive comment ranges, nonblank contents,
  settings choices, or GitHub revision strings. Adapters retain transport
  validation and use cases retain domain validation. An omitted resolution bool
  means reopen; omitted settings scalars or instruction content are invalid.
  `UpdateTag` retains its existing behavior: both nonoptional strings must be
  valid; omitted strings become empty strings rather than a REST partial patch.

`preview_messages_test.ts` checks type rejection, public field selection,
optional presence, scalar defaults, and integer conversion. SQLite integration
tests use the official Connect client to check persistence, nested responses,
isolation, errors, cache headers, and REST compatibility. The comment API tests
also verify that REST and RPC exports share the same serialization lock.
