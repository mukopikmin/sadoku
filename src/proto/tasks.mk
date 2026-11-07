.PHONY: proto-tools proto-lint proto-generate proto-check

proto-tools:
	$(GO) install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11
	$(GO) install connectrpc.com/connect/cmd/protoc-gen-connect-go@v1.20.0

proto-lint:
	cd src/proto && $(NPM) exec --no -- buf lint

proto-generate:
	cd src/proto && $(NPM) exec --no -- buf generate
	$(NPM) --prefix src/proto exec --no -- oxfmt "src/preview/gen/**/*.ts"

proto-check: proto-lint proto-generate
	git add --intent-to-add -- src/preview/gen src/server/internal/gen
	git diff --exit-code -- src/preview/gen src/server/internal/gen
