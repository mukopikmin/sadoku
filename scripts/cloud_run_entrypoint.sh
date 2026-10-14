#!/bin/sh
set -eu

exec sadoku start "${SADOKU_SOURCE:-/app/test/integration/fixtures}" \
  --host 0.0.0.0 \
  --port "${PORT:-8080}" \
  --no-open \
  --keep-alive
