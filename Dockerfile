FROM node:26-bookworm-slim AS builder

COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

# Allow minor and patch updates while enforcing the supported, patched ranges.
RUN set -eu; \
    node_version="$(node --version)"; \
    deno_version="$(deno --version | head -n 1 | cut -d ' ' -f 2)"; \
    dpkg --compare-versions "${node_version#v}" ge 26.12.1; \
    dpkg --compare-versions "${node_version#v}" lt 27; \
    dpkg --compare-versions "$deno_version" ge 2.9.8; \
    dpkg --compare-versions "$deno_version" lt 3

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY src/preview/package.json src/preview/package-lock.json ./src/preview/
RUN npm run install:deps

COPY . .
RUN deno task compile --output /sadoku

FROM debian:bookworm-slim

ENV HOME=/tmp/sadoku-home \
    SADOKU_COMMENTS_DIR=/tmp/sadoku-comments

WORKDIR /app

COPY --from=builder /sadoku /usr/local/bin/sadoku
COPY . /app/
COPY scripts/cloud_run_entrypoint.sh /usr/local/bin/cloud-run-entrypoint

RUN chmod 755 /usr/local/bin/cloud-run-entrypoint \
    && chown -R nobody:nogroup /app

USER nobody:nogroup

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/cloud-run-entrypoint"]
