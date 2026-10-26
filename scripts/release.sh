#!/usr/bin/env bash
# Run from the repository root. Requires git, gh, and jq; never publishes a release.
set -euo pipefail

fail() { printf '%s\n' "$*" >&2; exit 1; }
command=${1:-}
case "$command" in check|notes) shift ;; *) fail "Expected command 'check' or 'notes'." ;; esac
version='' output=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --version|--output)
      if [ "$#" -lt 2 ] || [[ $2 == --* ]]; then fail "Missing value for $1."; fi
      case "$1" in --version) version=$2 ;; --output) output=$2 ;; esac
      shift 2 ;;
    *) fail "Unknown argument: $1" ;;
  esac
done
stable='(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)'
[[ $version =~ ^${stable}$ ]] || fail "Invalid semantic version: $version"
[ "$command" != notes ] || [ -n "$output" ] || fail 'The notes command requires --output <path>.'
[ ! -d "$output" ] || fail "Notes output must be a file: $output"
filter=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/release.jq
baseline=release-notes-baseline
head=$(git rev-parse HEAD)
repository=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
info=$(git for-each-ref '--format=%(objecttype)%0a%(contents:trailers:key=Previous-Stable-Tag,valueonly)' "refs/tags/v$version")
approved=${info#*$'\n'}
if [[ $info != $'tag\n'* ]] ||
   { [ "$approved" != "$baseline" ] && [[ ! $approved =~ ^v${stable}$ ]]; }; then
  fail 'Release requires an annotated tag with exactly one Previous-Stable-Tag trailer containing a stable tag or release-notes-baseline.'
fi
# Fetch every page, including drafts. A command or JSON failure must stop the release.
releases=$(gh api --paginate "repos/$repository/releases?per_page=100" --jq '.[] | {tagName: .tag_name, isDraft: .draft, isPrerelease: .prerelease}')
releases=$(printf '%s' "$releases" | jq -s '.')
tags=$(git ls-remote --tags origin 'refs/tags/v*')
context=$(jq -n --arg mode context --arg version "$version" --arg head "$head" \
  --arg repository "$repository" --arg approved "$approved" --arg tags "$tags" \
  --argjson releases "$releases" -f "$filter")
previous_tag=$(jq -r .previousStableTag <<< "$context")
previous=$(git rev-parse --verify "refs/tags/$previous_tag^{commit}")

if [ "$command" = check ]; then
  git fetch --no-tags origin main >&2
  main=$(git rev-parse origin/main)
  ref="refs/tags/v$version"
  tag_object=$(git rev-parse --verify "$ref")
  tag_commit=$(git rev-parse --verify "$ref^{commit}")
  remote=$(git ls-remote --exit-code --tags origin "$ref")
  ancestor=false
  if git merge-base --is-ancestor "$previous" "$head"; then
    ancestor=true
  else
    status=$?
    [ "$status" -eq 1 ] || fail "git merge-base failed with status $status"
  fi
  root_ok=true
  if [ "$previous_tag" = "$baseline" ]; then
    root=$(git rev-list --max-parents=0 HEAD)
    [ "$root" = "$previous" ] || root_ok=false
  fi
  ci=$(gh run list --repo "$repository" --workflow test.yml --branch main --event push \
    --commit "$head" --limit 1 --json databaseId,workflowName,headBranch,event,status,conclusion,headSha,url)
  result=$(jq -n --arg mode check --arg version "$version" --argjson context "$context" \
    --arg main "$main" --arg tag_object "$tag_object" --arg tag_commit "$tag_commit" \
    --arg remote "$remote" --arg previous "$previous" --argjson ancestor "$ancestor" \
    --argjson root_ok "$root_ok" --argjson ci "$ci" -f "$filter")
  printf '%s\n' "$result"
  jq -e '.ok' <<< "$result" >/dev/null
else
  notes=$(gh api --method POST "repos/$repository/releases/generate-notes" \
    -f "tag_name=v$version" -f "target_commitish=$head" -f "previous_tag_name=$previous_tag")
  result=$(jq -n --arg mode notes --arg version "$version" --argjson context "$context" \
    --argjson notes "$notes" -f "$filter")
  # Place the temporary file beside the destination so renaming is atomic.
  temporary=$(mktemp "$(dirname -- "$output")/.sadoku-notes.XXXXXX")
  trap 'rm -f -- "$temporary"' EXIT
  printf '%s\n' "$result" > "$temporary"
  chmod 644 "$temporary"
  mv -f -- "$temporary" "$output"
  printf '%s\n' "$result"
fi
