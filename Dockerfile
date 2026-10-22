FROM node:26.12.1-bookworm-slim AS builder

COPY --from=denoland/deno:bin-2.9.8 /deno /usr/local/bin/deno

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
