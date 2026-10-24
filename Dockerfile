FROM node:bookworm-slim AS builder

COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY src/preview/package.json src/preview/package-lock.json ./src/preview/
RUN npm_config_engine_strict=true npm run install:deps

COPY . .
RUN deno task compile --output /sadoku

FROM debian:bookworm-slim

ENV HOME=/tmp/sadoku-home \
    SADOKU_COMMENTS_DIR=/tmp/sadoku-comments

WORKDIR /app

COPY --from=builder /sadoku /usr/local/bin/sadoku
COPY . /app/

RUN chown -R nobody:nogroup /app

USER nobody:nogroup

EXPOSE 8080

ENTRYPOINT ["/bin/sh", "/app/scripts/preview_entrypoint.sh"]
CMD ["/bin/sh", "/app/scripts/cloud_run_entrypoint.sh"]
