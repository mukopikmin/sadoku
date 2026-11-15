# RPC adapter boundary

`preview_rpc.go` implements the generated Connect service. `rpc.go` converts
Protobuf messages to application inputs and results to generated responses;
RPC and REST share session operations without calling each other's endpoints.
Generate Go and TypeScript bindings together with `make proto-generate`.

The schema controls public response fields. Response conversion discards unknown
application fields: for example, `Tag` omits storage timestamps, while
`TagSummary` retains them. REST uses numeric IDs; Connect JSON encodes `uint64`
IDs as strings, and the browser client decodes them to `bigint`. Support both
Connect JSON and binary Protobuf.

Proto3 defaults omitted nonoptional scalars and lists; optional fields preserve
presence. Keep domain validation after decoding, including nonblank content,
valid ranges and settings, and IDs within the storage range. An omitted
resolution bool reopens a comment. `UpdateTag` requires both strings, while
REST permits partial updates. `UpdateSettings` preserves current values for
the presence-sensitive settings handled in `rpc.go`.

Global instructions do not use a document ID. Their IDs are independent of
document instruction IDs; zero document IDs never select global scope.
Dynamic responses and errors use `Cache-Control: no-store`; successful REST
deletes without a resource return 204.

Adapter contracts are exercised in the parent directory's `router_test.go`,
`contracts_test.go`, and `global_instructions_test.go`, including JSON and binary
clients. See [legacy fixture rules](../testdata/README.md) for captured behavior.
