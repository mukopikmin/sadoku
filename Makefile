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
GO_SOURCES := src/cmd src/internal src/preview/assets.go src/gen/go src/test/integration

.PHONY: deps build-client test-client test-actions fmt-client check-client-format \
 build build-server install dist notices run start test test-server test-server-with-assets \
 test-tools test-install test-install-with-assets check vet vet-cross \
 fmt fmt-go fmt-check check-go-format proto-tools proto-lint proto-generate proto-check \
 check-proxy-format vet-proxy test-proxy build-proxy run-proxy

deps:
	$(NPM) run install:deps

build-client:
	$(NPM) run build:client

test-client:
	$(NPM) test

test-actions:
	$(NPM) run test:actions

fmt-client:
	$(NPM) run fmt

check-client-format:
	$(NPM) run fmt:check

build: build-client
	$(MAKE) build-server

# Client assets must already exist; container builds supply them from a separate stage.
build-server:
	$(GO) run ./src/cmd/sadoku-tools build --version "$(VERSION)" $(foreach target,$(TARGET),--target "$(target)") $(if $(OUTPUT),--output "$(OUTPUT)")

install: build-client
	$(GO) run ./src/cmd/sadoku-tools install --version "$(VERSION)"

dist: build-client
	$(GO) run ./src/cmd/sadoku-tools dist --version "$(VERSION)" --binary-version "$(BINARY_VERSION)" $(foreach target,$(TARGET),--target "$(target)")

notices: build-client
	$(GO) run ./src/cmd/sadoku-tools notices

run: build-client
	$(GO) run ./src/cmd/sadoku $(ARGS)

start: build-client
	$(GO) run ./src/cmd/sadoku start $(ARGS)

test: test-server test-client test-actions test-proxy

test-server: build-client
	$(MAKE) test-server-with-assets

# CI builds assets once before running these targets. Keep the default targets
# building the client so local runs cannot silently use stale embedded assets.
test-server-with-assets:
	$(GO) test $(GO_TEST_FLAGS) ./...

test-tools:
	$(GO) test -race -count=1 ./src/internal/tooling
	$(NPM) run test:actions

test-install: build-client
	$(MAKE) test-install-with-assets

test-install-with-assets:
	@set -eu; install_home=$$(mktemp -d); \
	trap 'rm -rf "$$install_home"' EXIT; \
	GOMODCACHE="$$($(GO) env GOMODCACHE)" GOCACHE="$$($(GO) env GOCACHE)" \
	HOME="$$install_home" $(GO) run ./src/cmd/sadoku-tools install --version 0.0.0-ci; \
	test "$$("$$install_home/.local/bin/sadoku" --version)" = "sadoku 0.0.0-ci"

check: fmt-check vet vet-proxy

vet: build-client
	$(GO) vet ./...

# Repository tooling needs native SQLite CGO APIs; cross-check application Go code.
vet-cross: vet
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GO) vet ./src/cmd/sadoku ./src/internal/server/... ./src/preview/... ./src/gen/go/... ./src/test/integration/...
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(GO) vet ./src/cmd/sadoku ./src/internal/server/... ./src/preview/... ./src/gen/go/... ./src/test/integration/...

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
	$(NPM) run proto:lint

proto-generate:
	$(NPM) run proto:generate

proto-check: proto-lint proto-generate
	git add --intent-to-add -- src/gen/ts src/gen/go
	git diff --exit-code -- src/gen/ts src/gen/go

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
