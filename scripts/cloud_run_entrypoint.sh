#!/bin/sh
set -eu

exec /usr/local/bin/sadoku start "${SADOKU_SOURCE:-/app/README.md}" \
  --host 0.0.0.0 \
  --port "${PORT:-8080}" \
  --no-open \
  --keep-alive
