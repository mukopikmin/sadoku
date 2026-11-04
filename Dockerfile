# syntax=docker/dockerfile:1

FROM node:bookworm-slim AS client

WORKDIR /workspace

COPY src/preview/package.json src/preview/package-lock.json ./src/preview/
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm --prefix src/preview ci
COPY src/preview/ ./src/preview/
RUN npm --prefix src/preview run build

FROM golang:1.26.10-bookworm AS go-toolchain

FROM debian:bookworm-slim AS builder

COPY --from=go-toolchain /usr/local/go /usr/local/go
COPY --from=go-toolchain /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV PATH="/usr/local/go/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends make gcc libc6-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY src/sadoku/go.mod src/sadoku/go.sum ./src/sadoku/
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export SSL_CERT_FILE=/run/secrets/proxy_ca; fi; \
    go -C src/sadoku mod download

COPY Makefile ./
COPY src/sadoku/cmd/ ./src/sadoku/cmd/
COPY src/sadoku/internal/ ./src/sadoku/internal/
COPY --from=client /workspace/src/preview/dist/ ./src/sadoku/internal/preview/dist/
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
