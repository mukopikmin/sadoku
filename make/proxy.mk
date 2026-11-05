.PHONY: check-proxy-format vet-proxy test-proxy build-proxy run-proxy

check-proxy-format:
	test -z "$$(gofmt -l proxy)"

vet-proxy:
	$(GO) -C proxy vet ./...

test-proxy:
	$(GO) -C proxy test -race -count=1 -timeout=60s ./...

build-proxy:
	CGO_ENABLED=0 $(GO) -C proxy build ./...

run-proxy:
	$(GO) -C proxy run ./cmd/revision-proxy
