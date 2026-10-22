#!/bin/sh
set -eu

script_dir="$(CDPATH= cd "$(dirname "$0")" && pwd)"

if [ -z "${SADOKU_SOURCE:-}" ]; then
  preview_root="$(mktemp -d "${TMPDIR:-/tmp}/sadoku-preview.XXXXXX")"
  export SADOKU_SOURCE="$preview_root/documents"
  export SADOKU_COMMENTS_DIR="$preview_root/comments"
  printf '%s\n' 'Preparing preview sample data...' >&2
  if ! sh "$script_dir/cloud_run_preview_seed.sh" "$preview_root"; then
    rm -rf "$preview_root"
    printf '%s\n' 'Failed to prepare preview sample data.' >&2
    exit 1
  fi
fi

exec sh "$script_dir/cloud_run_entrypoint.sh" "$@"
