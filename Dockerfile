FROM node:24-bookworm-slim AS builder

COPY --from=denoland/deno:bin-2.8.0 /deno /usr/local/bin/deno

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
COPY README.md /app/README.md
COPY scripts/cloud_run_entrypoint.sh /usr/local/bin/cloud-run-entrypoint

RUN chmod +x /usr/local/bin/cloud-run-entrypoint \
    && chown -R nobody:nogroup /app

USER nobody:nogroup

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/cloud-run-entrypoint"]
