#!/bin/sh
set -eu

case "${SADOKU_TRUST_FORWARDED_PREFIX:-false}" in
  true) set -- --trust-forwarded-prefix ;;
  false|'') set -- ;;
  *) printf '%s\n' 'SADOKU_TRUST_FORWARDED_PREFIX must be true or false.' >&2; exit 2 ;;
esac

if [ -n "${SADOKU_SOURCE:-}" ]; then
  preview_source="$SADOKU_SOURCE"
else
  script_dir="$(CDPATH= cd "$(dirname "$0")" && pwd)"
  preview_root="$(mktemp -d "${TMPDIR:-/tmp}/sadoku-preview.XXXXXX")"
  preview_source="$preview_root/documents"
  export SADOKU_COMMENTS_DIR="$preview_root/comments"
  printf '%s\n' 'Preparing preview sample data...' >&2
  if ! sh "$script_dir/cloud_run_preview_seed.sh" "$preview_root"; then
    rm -rf "$preview_root"
    printf '%s\n' 'Failed to prepare preview sample data.' >&2
    exit 1
  fi
fi

exec sadoku start "$preview_source" \
  --host 0.0.0.0 \
  --port "${PORT:-8080}" \
  --no-open \
  --keep-alive "$@"
