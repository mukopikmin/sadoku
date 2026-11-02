# syntax=docker/dockerfile:1

FROM node:bookworm-slim AS client

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY src/preview/package.json src/preview/package-lock.json ./src/preview/
# Optional CA for builds behind a TLS proxy; never stored in an image layer.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm_config_engine_strict=true npm run install:deps

COPY src/preview/ ./src/preview/
COPY gen/ts/ ./gen/ts/
RUN npm run build:client

FROM golang:1.26.10-bookworm AS go-toolchain

FROM debian:bookworm-slim AS builder

COPY --from=go-toolchain /usr/local/go /usr/local/go
COPY --from=go-toolchain /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV PATH="/usr/local/go/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends make gcc libc6-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY go.mod go.sum ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export SSL_CERT_FILE=/run/secrets/proxy_ca; fi; \
    go mod download

COPY Makefile ./
COPY cmd/ ./cmd/
COPY internal/ ./internal/
COPY src/server/ ./src/server/
COPY gen/go/ ./gen/go/
COPY src/preview/assets.go ./src/preview/assets.go
COPY --from=client /workspace/src/preview/dist/ ./src/preview/dist/
RUN make build-server

# The Linux binary is statically linked, including SQLite. Alpine supplies the
# shell and utilities used by the preview launcher without a Debian runtime.
FROM alpine:3.23

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

ENV HOME=/tmp/sadoku-home \
    SADOKU_COMMENTS_DIR=/tmp/sadoku-comments

WORKDIR /app

COPY --from=builder /workspace/sadoku /usr/local/bin/sadoku
COPY --chown=65534:65534 . /app/

USER 65534:65534

EXPOSE 8080

ENTRYPOINT ["/bin/sh", "/app/scripts/preview_entrypoint.sh"]
CMD ["/bin/sh", "/app/scripts/cloud_run_entrypoint.sh"]
