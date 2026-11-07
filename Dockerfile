# syntax=docker/dockerfile:1

FROM node:bookworm-slim AS client

RUN apt-get update && apt-get install -y --no-install-recommends make && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY Makefile ./
COPY src/proto/tasks.mk ./src/proto/
COPY src/proxy/tasks.mk ./src/proxy/
COPY src/proto/package.json src/proto/package-lock.json ./src/proto/
COPY src/preview/package.json src/preview/package-lock.json ./src/preview/
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    make deps
COPY src/preview/ ./src/preview/
RUN make build-client

FROM golang:1.26.10-bookworm AS go-toolchain

FROM debian:bookworm-slim AS builder

COPY --from=go-toolchain /usr/local/go /usr/local/go
COPY --from=go-toolchain /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV PATH="/usr/local/go/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends make gcc libc6-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY src/server/go.mod src/server/go.sum ./src/server/
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export SSL_CERT_FILE=/run/secrets/proxy_ca; fi; \
    go -C src/server mod download

COPY Makefile ./
COPY src/proto/tasks.mk ./src/proto/
COPY src/proxy/tasks.mk ./src/proxy/
COPY src/server/cmd/ ./src/server/cmd/
COPY src/server/internal/ ./src/server/internal/
COPY --from=client /workspace/src/preview/dist/ ./src/server/internal/preview/dist/
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
