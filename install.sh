#!/bin/sh

set -eu

repository="https://github.com/mukopikmin/sadoku"
install_dir="${HOME:-}/.local/bin"
temporary_dir=""
staged_binary=""

cleanup() {
  if [ -n "$staged_binary" ]; then
    rm -f "$staged_binary"
  fi
  if [ -n "$temporary_dir" ]; then
    rm -rf "$temporary_dir"
  fi
}

fail() {
  echo "sadoku installer: $*" >&2
  exit 1
}

usage() {
  echo "Usage: install.sh [--nightly]" >&2
}

trap cleanup EXIT HUP INT TERM

if [ "$#" -gt 1 ]; then
  usage
  exit 1
fi

channel="latest"
if [ "$#" -eq 1 ]; then
  if [ "$1" != "--nightly" ]; then
    usage
    exit 1
  fi
  channel="nightly"
fi

[ -n "${HOME:-}" ] || fail "HOME is not set"

for command in curl tar mktemp; do
  command -v "$command" >/dev/null 2>&1 || fail "required command not found: $command"
done

case "$(uname -s):$(uname -m)" in
  Darwin:arm64 | Darwin:aarch64)
    target="darwin-arm64"
    ;;
  Linux:x86_64 | Linux:amd64)
    target="linux-x64"
    ;;
  *)
    fail "unsupported platform: $(uname -s) $(uname -m)"
    ;;
esac

release_url="$(curl -fsSL -o /dev/null -w '%{url_effective}' "$repository/releases/latest")" ||
  fail "could not resolve the latest release"
tag="${release_url##*/}"

if [ "$channel" = "nightly" ]; then
  tag="${tag}-nightly"
fi

case "$tag" in
  v[0-9]*.[0-9]*.[0-9]*) ;;
  *) fail "invalid release tag: $tag" ;;
esac

version="${tag#v}"
archive="sadoku-v${version}-${target}.tar.gz"
download_url="$repository/releases/download/$tag"
temporary_dir="$(mktemp -d "${TMPDIR:-/tmp}/sadoku-install.XXXXXX")"
archive_path="$temporary_dir/$archive"
checksum_path="$archive_path.sha256"

echo "Downloading sadoku $version for $target..."
curl -fsSL -o "$archive_path" "$download_url/$archive" ||
  fail "could not download $archive"
curl -fsSL -o "$checksum_path" "$download_url/$archive.sha256" ||
  fail "could not download $archive.sha256"

expected_checksum="$(tr -d '[:space:]' < "$checksum_path")"
case "$expected_checksum" in
  *[!0-9a-fA-F]* | "") fail "invalid SHA-256 checksum" ;;
esac
[ "${#expected_checksum}" -eq 64 ] || fail "invalid SHA-256 checksum"

if command -v sha256sum >/dev/null 2>&1; then
  actual_checksum="$(sha256sum "$archive_path" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  actual_checksum="$(shasum -a 256 "$archive_path" | awk '{print $1}')"
else
  fail "required command not found: sha256sum or shasum"
fi

[ "$actual_checksum" = "$expected_checksum" ] || fail "SHA-256 checksum mismatch"

tar -xzf "$archive_path" -C "$temporary_dir" || fail "could not extract $archive"
binary_path="$temporary_dir/sadoku-v${version}-${target}/sadoku"
[ -f "$binary_path" ] || fail "release archive does not contain sadoku"

mkdir -p "$install_dir"
staged_binary="$(mktemp "$install_dir/.sadoku.XXXXXX")"
cp "$binary_path" "$staged_binary"
chmod 755 "$staged_binary"
mv "$staged_binary" "$install_dir/sadoku"
staged_binary=""

echo "Installed sadoku $version to $install_dir/sadoku"
case ":${PATH:-}:" in
  *":$install_dir:"*) ;;
  *) echo "Add $install_dir to your PATH to run sadoku." ;;
esac
