#!/bin/sh
set -eu

case "${SADOKU_TRUST_FORWARDED_PREFIX:-false}" in
  true) set -- --trust-forwarded-prefix ;;
  false|'') set -- ;;
  *) printf '%s\n' 'SADOKU_TRUST_FORWARDED_PREFIX must be true or false.' >&2; exit 2 ;;
esac

exec sadoku start "${SADOKU_SOURCE:-/app/test/integration/fixtures}" \
  --host 0.0.0.0 \
  --port "${PORT:-8080}" \
  --no-open \
  --keep-alive "$@"
