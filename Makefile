.DEFAULT_GOAL := build
SHELL := sh

GO ?= go
NPM ?= npm
NODE ?= node
export CGO_ENABLED := 1
VERSION ?= 0.0.0-dev
OUTPUT ?=
TARGET ?=
BINARY_VERSION ?= $(VERSION)
ARGS ?=
GO_TEST_FLAGS ?= -race -count=1 -timeout=120s
GO_SOURCES := cmd internal src/server src/preview/assets.go gen/go test/integration

.PHONY: deps build-client test-client test-actions fmt-client check-client-format \
 build build-server install dist notices run start test test-server test-server-with-assets \
 test-tools test-install test-install-with-assets check vet vet-cross \
 fmt fmt-go fmt-check check-go-format

deps:
	$(NPM) ci --ignore-scripts
	$(NPM) ci --prefix src/preview

build-client:
	$(NPM) --prefix src/preview run build

test-client:
	$(NPM) --prefix src/preview test

test-actions:
	$(NODE) --test scripts/cloud_run_preview_comment_test.mts

fmt-client:
	$(NPM) exec --no -- prettier --write scripts/*.mts gen/ts

check-client-format:
	$(NPM) exec --no -- prettier --check scripts/*.mts gen/ts

build: build-client
	$(MAKE) build-server

# Client assets must already exist; container builds supply them from a separate stage.
build-server:
	$(GO) run ./cmd/sadoku-tools build --version "$(VERSION)" $(foreach target,$(TARGET),--target "$(target)") $(if $(OUTPUT),--output "$(OUTPUT)")

install: build-client
	$(GO) run ./cmd/sadoku-tools install --version "$(VERSION)"

dist: build-client
	$(GO) run ./cmd/sadoku-tools dist --version "$(VERSION)" --binary-version "$(BINARY_VERSION)" $(foreach target,$(TARGET),--target "$(target)")

notices: build-client
	$(GO) run ./cmd/sadoku-tools notices

run: build-client
	$(GO) run ./cmd/sadoku $(ARGS)

start: build-client
	$(GO) run ./cmd/sadoku start $(ARGS)

test: test-server test-client test-actions test-proxy

test-server: build-client
	$(MAKE) test-server-with-assets

# CI builds assets once before running these targets. Keep the default targets
# building the client so local runs cannot silently use stale embedded assets.
test-server-with-assets:
	$(GO) test $(GO_TEST_FLAGS) ./...

test-tools:
	$(GO) test -race -count=1 ./internal/tooling
	$(NODE) --test scripts/cloud_run_preview_comment_test.mts

test-install: build-client
	$(MAKE) test-install-with-assets

test-install-with-assets:
	@set -eu; install_home=$$(mktemp -d); \
	trap 'rm -rf "$$install_home"' EXIT; \
	GOMODCACHE="$$($(GO) env GOMODCACHE)" GOCACHE="$$($(GO) env GOCACHE)" \
	HOME="$$install_home" $(GO) run ./cmd/sadoku-tools install --version 0.0.0-ci; \
	test "$$("$$install_home/.local/bin/sadoku" --version)" = "sadoku 0.0.0-ci"

check: fmt-check vet vet-proxy

vet: build-client
	$(GO) vet ./...

# Repository tooling needs native SQLite CGO APIs; cross-check application Go code.
vet-cross: vet
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GO) vet ./cmd/sadoku ./src/... ./gen/go/... ./test/integration/...
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(GO) vet ./cmd/sadoku ./src/... ./gen/go/... ./test/integration/...

fmt: fmt-go fmt-client

fmt-go:
	gofmt -w $(GO_SOURCES) proxy

fmt-check: check-go-format check-client-format check-proxy-format

check-go-format:
	test -z "$$(gofmt -l $(GO_SOURCES))"

include make/proto.mk
include make/proxy.mk
