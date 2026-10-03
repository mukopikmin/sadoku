FROM node:24-bookworm-slim AS client-builder

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY src/preview/package.json src/preview/package-lock.json ./src/preview/
RUN npm run install:deps

COPY . .
RUN npm run build:client

FROM denoland/deno:2.8.0 AS binary-builder

WORKDIR /workspace
COPY --from=client-builder /workspace .

RUN DENO_NO_PACKAGE_JSON=1 deno compile \
    --quiet \
    --node-modules-dir=none \
    --no-check \
    -P=app \
    --include src/preview/dist \
    --output /sadoku \
    src/main.ts

FROM debian:bookworm-slim

ENV HOME=/tmp/sadoku-home \
    SADOKU_COMMENTS_DIR=/tmp/sadoku-comments

WORKDIR /app

COPY --from=binary-builder /sadoku /usr/local/bin/sadoku
COPY README.md /app/README.md
COPY scripts/cloud_run_entrypoint.sh /usr/local/bin/cloud-run-entrypoint

RUN chmod +x /usr/local/bin/cloud-run-entrypoint \
    && chown -R nobody:nogroup /app

USER nobody:nogroup

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/cloud-run-entrypoint"]
