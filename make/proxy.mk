.PHONY: proxy-check-format proxy-vet proxy-test proxy-build proxy-run

proxy-check-format:
	test -z "$$(gofmt -l src/proxy)"

proxy-vet:
	$(GO) -C src/proxy vet ./...

proxy-test:
	$(GO) -C src/proxy test -race -count=1 -timeout=60s ./...

proxy-build:
	CGO_ENABLED=0 $(GO) -C src/proxy build ./...

proxy-run:
	$(GO) -C src/proxy run ./cmd/revision-proxy
