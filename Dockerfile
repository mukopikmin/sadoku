FROM golang:1.26-bookworm AS go-toolchain

FROM node:bookworm-slim AS builder

COPY --from=go-toolchain /usr/local/go /usr/local/go
ENV PATH="/usr/local/go/bin:${PATH}"

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY src/preview/package.json src/preview/package-lock.json ./src/preview/
RUN npm_config_engine_strict=true npm run install:deps

COPY . .
RUN npm run build:client && CGO_ENABLED=0 npm run build:server

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

ENV HOME=/tmp/sadoku-home \
    SADOKU_COMMENTS_DIR=/tmp/sadoku-comments

WORKDIR /app

COPY --from=builder /workspace/sadoku /usr/local/bin/sadoku
COPY . /app/

RUN chown -R nobody:nogroup /app

USER nobody:nogroup

EXPOSE 8080

ENTRYPOINT ["/bin/sh", "/app/scripts/preview_entrypoint.sh"]
CMD ["/bin/sh", "/app/scripts/cloud_run_entrypoint.sh"]
