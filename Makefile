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
# The timeout covers an entire package. Windows runners need more time for
# SQLite migrations and other disk writes, especially with the race detector.
GO_TEST_TIMEOUT ?= $(if $(filter Windows_NT,$(OS)),10m,120s)
GO_TEST_FLAGS ?= -race -count=1 -timeout=$(GO_TEST_TIMEOUT)
GO_SOURCES := src/server/cmd src/server/internal src/server/internal/preview/assets.go src/server/internal/gen src/server/test/integration

.PHONY: deps build-client test-client test-actions fmt-client check-client-format \
 build build-server install dist notices run start test test-server test-server-with-assets \
 test-tools test-install test-install-with-assets check vet vet-cross \
 fmt fmt-go fmt-check check-go-format

deps:
	$(NPM) --prefix src/proto ci --ignore-scripts
	$(NPM) --prefix src/preview ci

build-client:
	$(NPM) --prefix src/preview run build
	rm -rf src/server/internal/preview/dist
	mkdir -p src/server/internal/preview
	cp -R src/preview/dist src/server/internal/preview/dist

test-client:
	$(NPM) --prefix src/preview test

test-actions:
	$(NODE) --test scripts/cloud_run_preview_comment_test.mts

fmt-client:
	cd src/proto && $(NPM) exec --no -- prettier --write ../../scripts/*.mts ../preview/gen

check-client-format:
	cd src/proto && $(NPM) exec --no -- prettier --check ../../scripts/*.mts ../preview/gen

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

test: test-server test-client test-actions proxy-test

test-server: build-client
	$(MAKE) test-server-with-assets

# CI builds assets once before running these targets. Keep the default targets
# building the client so local runs cannot silently use stale embedded assets.
test-server-with-assets:
	$(GO) -C src/server test $(GO_TEST_FLAGS) ./...

test-tools:
	$(GO) -C src/server test -race -count=1 ./internal/tooling
	$(NODE) --test scripts/cloud_run_preview_comment_test.mts

test-install: build-client
	$(MAKE) test-install-with-assets

test-install-with-assets:
	@set -eu; install_home=$$(mktemp -d); \
	trap 'rm -rf "$$install_home"' EXIT; \
	GOMODCACHE="$$($(GO) env GOMODCACHE)" GOCACHE="$$($(GO) env GOCACHE)" \
	HOME="$$install_home" $(GO) -C src/server run ./cmd/sadoku-tools install --version 0.0.0-ci; \
	test "$$("$$install_home/.local/bin/sadoku" --version)" = "sadoku 0.0.0-ci"

check: fmt-check vet proxy-vet

vet: build-client
	$(GO) -C src/server vet ./...

# Repository tooling needs native SQLite CGO APIs; cross-check application Go code.
vet-cross: vet
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GO) -C src/server vet ./cmd/sadoku ./internal/server/... ./internal/preview/... ./internal/gen/... ./test/integration/...
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(GO) -C src/server vet ./cmd/sadoku ./internal/server/... ./internal/preview/... ./internal/gen/... ./test/integration/...

fmt: fmt-go fmt-client

fmt-go:
	gofmt -w $(GO_SOURCES) src/proxy

fmt-check: check-go-format check-client-format proxy-check-format

check-go-format:
	test -z "$$(gofmt -l $(GO_SOURCES))"

include src/proto/tasks.mk
include src/proxy/tasks.mk
