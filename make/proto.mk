.PHONY: proto-tools proto-lint proto-generate proto-check

proto-tools:
	$(GO) install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11
	$(GO) install connectrpc.com/connect/cmd/protoc-gen-connect-go@v1.20.0

proto-lint:
	$(NPM) exec --no -- buf lint

proto-generate:
	$(NPM) exec --no -- buf generate
	$(NPM) exec --no -- prettier --write gen/ts

proto-check: proto-lint proto-generate
	git add --intent-to-add -- gen/ts gen/go
	git diff --exit-code -- gen/ts gen/go
