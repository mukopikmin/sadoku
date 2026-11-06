.DEFAULT_GOAL := build
SHELL := sh

GO ?= go
NPM ?= npm
export CGO_ENABLED := 1
VERSION ?= 0.0.0-dev
OUTPUT ?=
TARGET ?=
BINARY_VERSION ?= $(VERSION)
ARGS ?=
# The timeout covers an entire package. Windows runners need more time for
# SQLite migrations and other disk writes, especially with the race detector.
GO_TEST_TIMEOUT ?= $(if $(filter Windows_NT,$(OS)),10m,120s)
GO_TEST_FLAGS ?= -race -count=1 -timeout=$(GO_TEST_TIMEOUT)
GO_SOURCES := src/server/cmd src/server/internal src/server/internal/preview/assets.go src/server/internal/gen src/server/test/integration

.PHONY: deps build-client test-client test-actions fmt-client check-client-format \
 build build-server install dist notices run start test test-server test-server-with-assets \
 test-tools test-migrations test-install test-install-with-assets check vet vet-cross \
 fmt fmt-go fmt-check check-go-format proto-tools proto-lint proto-generate proto-check \
 check-proxy-format vet-proxy test-proxy build-proxy run-proxy

deps:
	$(NPM) --prefix src/proto ci --ignore-scripts
	$(NPM) --prefix src/preview ci

build-client:
	$(NPM) --prefix src/preview run build
	rm -rf src/server/internal/preview/dist
	cp -R src/preview/dist src/server/internal/preview/dist

test-client:
	$(NPM) --prefix src/preview test

test-actions:
	$(NPM) --prefix src/proto run test:actions

fmt-client:
	$(NPM) --prefix src/proto run fmt

check-client-format:
	$(NPM) --prefix src/proto run fmt:check

build: build-client
	$(MAKE) build-server

# Client assets must already exist; container builds supply them from a separate stage.
build-server:
	$(GO) -C src/server run ./cmd/sadoku-tools build --version "$(VERSION)" $(foreach target,$(TARGET),--target "$(target)") $(if $(OUTPUT),--output "$(OUTPUT)")

install: build-client
	$(GO) -C src/server run ./cmd/sadoku-tools install --version "$(VERSION)"

dist: build-client
	$(GO) -C src/server run ./cmd/sadoku-tools dist --version "$(VERSION)" --binary-version "$(BINARY_VERSION)" $(foreach target,$(TARGET),--target "$(target)")

notices: build-client
	$(GO) -C src/server run ./cmd/sadoku-tools notices

run: build-client
	$(GO) -C src/server run ./cmd/sadoku $(ARGS)

start: build-client
	$(GO) -C src/server run ./cmd/sadoku start $(ARGS)

test: test-server test-client test-actions test-proxy

test-server: build-client
	$(MAKE) test-server-with-assets

# CI builds assets once before running these targets. Keep the default targets
# building the client so local runs cannot silently use stale embedded assets.
test-server-with-assets:
	$(GO) -C src/server test $(GO_TEST_FLAGS) ./...

test-migrations: build-client
	$(GO) -C src/server test $(GO_TEST_FLAGS) -v ./internal/server/db

test-tools:
	$(GO) -C src/server test -race -count=1 ./internal/tooling
	$(NPM) --prefix src/proto run test:actions

test-install: build-client
	$(MAKE) test-install-with-assets

test-install-with-assets:
	@set -eu; install_home=$$(mktemp -d); \
	trap 'rm -rf "$$install_home"' EXIT; \
	GOMODCACHE="$$($(GO) env GOMODCACHE)" GOCACHE="$$($(GO) env GOCACHE)" \
	HOME="$$install_home" $(GO) -C src/server run ./cmd/sadoku-tools install --version 0.0.0-ci; \
	test "$$("$$install_home/.local/bin/sadoku" --version)" = "sadoku 0.0.0-ci"

check: fmt-check vet vet-proxy

vet: build-client
	$(GO) -C src/server vet ./...

# Repository tooling needs native SQLite CGO APIs; cross-check application Go code.
vet-cross: vet
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GO) -C src/server vet ./cmd/sadoku ./internal/server/... ./internal/preview/... ./internal/gen/... ./test/integration/...
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(GO) -C src/server vet ./cmd/sadoku ./internal/server/... ./internal/preview/... ./internal/gen/... ./test/integration/...

fmt: fmt-go fmt-client

fmt-go:
	gofmt -w $(GO_SOURCES) src/proxy

fmt-check: check-go-format check-client-format check-proxy-format

check-go-format:
	test -z "$$(gofmt -l $(GO_SOURCES))"

proto-tools:
	$(GO) install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11
	$(GO) install connectrpc.com/connect/cmd/protoc-gen-connect-go@v1.20.0

proto-lint:
	$(NPM) --prefix src/proto run proto:lint

proto-generate:
	$(NPM) --prefix src/proto run proto:generate

proto-check: proto-lint proto-generate
	git add --intent-to-add -- src/preview/gen src/server/internal/gen
	git diff --exit-code -- src/preview/gen src/server/internal/gen

check-proxy-format:
	test -z "$$(gofmt -l src/proxy)"

vet-proxy:
	$(GO) -C src/proxy vet ./...

test-proxy:
	$(GO) -C src/proxy test -race -count=1 -timeout=60s ./...

build-proxy:
	CGO_ENABLED=0 $(GO) -C src/proxy build ./...

run-proxy:
	$(GO) -C src/proxy run ./cmd/revision-proxy
