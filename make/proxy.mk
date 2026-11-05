.PHONY: proxy-check-format proxy-vet proxy-test proxy-build proxy-run

proxy-check-format:
	test -z "$$(gofmt -l proxy)"

proxy-vet:
	$(GO) -C proxy vet ./...

proxy-test:
	$(GO) -C proxy test -race -count=1 -timeout=60s ./...

proxy-build:
	CGO_ENABLED=0 $(GO) -C proxy build ./...

proxy-run:
	$(GO) -C proxy run ./cmd/revision-proxy
