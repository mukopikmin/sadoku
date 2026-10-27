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
stable='(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)'
[[ $version =~ ^${stable}$ ]] || fail "Invalid semantic version: $version"
[ "$command" != notes ] || [ -n "$output" ] || fail 'The notes command requires --output <path>.'
[ ! -d "$output" ] || fail "Notes output must be a file: $output"
tag="v$version"
head=$(git rev-parse HEAD)
repository=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

# Resolve the approved comparison tag against a fresh, complete release list.
info=$(git for-each-ref '--format=%(objecttype)%0a%(contents:trailers:key=Previous-Stable-Tag,valueonly)' "refs/tags/$tag")
approved=${info#*$'\n'}
if [[ $info != $'tag\n'* ]] ||
   { [ "$approved" != release-notes-baseline ] && [[ ! $approved =~ ^v${stable}$ ]]; }; then
  fail 'Release requires an annotated tag with exactly one valid Previous-Stable-Tag trailer.'
fi
releases=$(gh api --paginate "repos/$repository/releases?per_page=100" \
  --jq '.[] | {tagName: .tag_name, isDraft: .draft, isPrerelease: .prerelease}' | jq -s '
  if all(.[]; (.tagName | type == "string") and (.isDraft | type == "boolean") and
    (.isPrerelease | type == "boolean")) then . else error("Invalid release metadata") end')
previous_tag=$(jq -r --arg stable "^v${stable}$" '
  map(select(.isDraft == false and .isPrerelease == false and (.tagName | test($stable)))) |
  .[0].tagName // "release-notes-baseline"' <<< "$releases")
tags=$(git ls-remote --tags origin 'refs/tags/v*')
if [ "$previous_tag" = release-notes-baseline ]; then
  other_tags=$(awk -v current="refs/tags/$tag" -v stable="^refs/tags/v${stable}$" \
    'NF == 2 && $2 != current && $2 ~ stable { print $2 }' <<< "$tags")
  [ -z "$other_tags" ] || fail "Stable tags exist but no stable releases were returned: $other_tags"
fi
[ "$previous_tag" = "$approved" ] || fail "Notes baseline $previous_tag differs from the approved tag $approved."
previous=$(git rev-parse --verify "refs/tags/$previous_tag^{commit}")
metadata=$(jq -n --arg version "$version" --arg tag "$tag" --arg headSha "$head" \
  --arg previousStableTag "$previous_tag" '$ARGS.named')

if [ "$command" = check ]; then
  git fetch --no-tags origin main >&2
  main=$(git rev-parse origin/main)
  [ "$head" = "$main" ] || fail "HEAD $head must match origin/main $main."
  tag_object=$(git rev-parse --verify "refs/tags/$tag")
  tag_commit=$(git rev-parse --verify "refs/tags/$tag^{commit}")
  [ "$tag_commit" = "$head" ] || fail "Release tag $tag must point to HEAD $head."
  remote=$(git ls-remote --exit-code --tags origin "refs/tags/$tag")
  remote_object=$(awk -v ref="refs/tags/$tag" 'NF == 2 && $2 == ref { print $1 }' <<< "$remote")
  [ "$remote_object" = "$tag_object" ] || fail "Release tag $tag differs on origin."
  jq -e --arg tag "$tag" 'all(.[]; .tagName != $tag)' <<< "$releases" >/dev/null || fail "Release $tag already exists, including drafts."
  [ "$previous" != "$head" ] || fail 'Notes baseline must be an earlier commit.'
  git merge-base --is-ancestor "$previous" "$head" || fail 'Notes baseline must be an ancestor of HEAD.'
  if [ "$previous_tag" = release-notes-baseline ]; then
    root=$(git rev-list --max-parents=0 HEAD)
    [ "$previous" = "$root" ] || fail 'First release baseline must be the repository root.'
  else
    jq -en --arg next "$version" --arg old "${previous_tag#v}" '
      def parts: split(".") | map([length, .]); ($next | parts) > ($old | parts)' >/dev/null ||
      fail "Version $version must be newer than $previous_tag."
  fi
  ci=$(gh run list --repo "$repository" --workflow test.yml --branch main --event push \
    --commit "$head" --limit 1 --json databaseId,workflowName,headBranch,event,status,conclusion,headSha,url)
  jq -e --arg head "$head" 'type == "array" and any(.[];
    (.databaseId | type) == "number" and .databaseId > 0 and .workflowName == "Test" and
    .headBranch == "main" and .event == "push" and .status == "completed" and
    .conclusion == "success" and .headSha == $head and (.url | type) == "string" and
    (.url | length) > 0)' <<< "$ci" >/dev/null || fail "No successful Test push run on main for $head."
  jq --arg tagObject "$tag_object" '. + {tagObject: $tagObject}' <<< "$metadata"
else
  notes=$(gh api --method POST "repos/$repository/releases/generate-notes" \
    -f "tag_name=$tag" -f "target_commitish=$head" -f "previous_tag_name=$previous_tag")
  jq -e '.body | strings | test("\\S")' <<< "$notes" >/dev/null || fail 'Generated release notes are empty.'
  # Write beside the destination so a failure cannot replace the existing file.
  temporary=$(mktemp "$(dirname -- "$output")/.sadoku-notes.XXXXXX")
  trap 'rm -f -- "$temporary"' EXIT
  jq --argjson release "$metadata" '$release + {body: .body,
    title: (if (.name | type) == "string" and .name != "" then .name else $release.tag end)}' \
    <<< "$notes" > "$temporary"
  chmod 644 "$temporary"
  mv -f -- "$temporary" "$output"
  cat -- "$output"
fi
