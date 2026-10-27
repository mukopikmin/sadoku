#!/bin/sh
set -eu

# Prepare sample data in the fresh directory owned by preview_entrypoint.sh.
script_dir="$(CDPATH= cd "$(dirname "$0")" && pwd)"
fixture_dir="$script_dir/../test/integration/fixtures"
documents="$1/documents"

mkdir -p "$documents"
cp -R "$fixture_dir/." "$documents/"

for document in "$documents/"*.md "$documents/"*/*.md "$documents/"*/*/*.md; do
  [ -f "$document" ] || continue
  seed_title="$(awk '/^# / { sub(/^# /, ""); print; exit }' "$document")"
  sadoku document add "$document" --title "$seed_title" >/dev/null
done

# Tag IDs start at 1 in the fresh preview database.
sadoku tag add --name 'Needs review' >/dev/null
sadoku tag add --name 'Markdown' >/dev/null
sadoku tag add --name 'Archived' >/dev/null
sadoku tag add --name 'Unassigned' >/dev/null
sadoku document tag add 1 2 --source "$documents/comprehensive.md" >/dev/null
sadoku document tag add 1 --source "$documents/second.md" >/dev/null
sadoku document tag add 2 --source "$documents/japanese.md" >/dev/null
sadoku document tag add 3 --source "$documents/guides/overview.md" >/dev/null

# Locate the selected text so formatting changes do not silently move comments.
add_comment() {
  seed_file="$1"
  seed_line="$(awk -v text="$2" 'index($0, text) { print NR; exit }' "$seed_file")"
  seed_body="$3"
  shift 3
  sadoku comment add --source "$seed_file" --start-line "$seed_line" \
    --body "$seed_body" "$@" >/dev/null
}

review="$documents/comprehensive.md"
add_comment "$review" '# Comprehensive Document' \
  'Open comment: check how each Markdown element renders.'
# Save enough drafts to exercise the twenty-revision list and its oldest diff.
# Keep a comment on the unchanged heading so comment list persists each edit.
revision=1
while [ "$revision" -le 23 ]; do
  awk -v revision="$revision" '
    $0 == "# Comprehensive Document" {
      print
      print ""
      print "Review draft " revision ": compare this version with the preceding draft in Revisions."
      next
    }
    $0 == "Text before a subheading." {
      print "Draft " revision ": add context before this subheading."
      next
    }
    { print }
  ' "$fixture_dir/comprehensive.md" > "$review.updated"
  mv "$review.updated" "$review"
  sadoku comment list --source "$review" >/dev/null
  revision=$((revision + 1))
done
cp "$fixture_dir/comprehensive.md" "$review.updated"
mv "$review.updated" "$review"
sadoku comment list --source "$review" >/dev/null

add_comment "$review" 'Text before a subheading.' \
  'Add more context before this subheading.' --as-bot
sadoku comment reply add --source "$review" --comment 2 \
  --body 'I checked the introduction and will add more context.' >/dev/null
sadoku comment reply add --source "$review" --comment 2 --as-bot --request-review \
  --body 'Please review the added context. This reply requests another review.' >/dev/null
add_comment "$review" 'Paragraph after simple nested lists.' \
  'Resolved comment: reopen this thread to try the review workflow.'
sadoku comment reply add --source "$review" --comment 3 \
  --body 'Confirmed. This thread is ready to resolve.' >/dev/null
sadoku comment resolve 3 --source "$review" >/dev/null
add_comment "$review" '- [ ] unchecked task' \
  'Checklist comment: try the steps and confirm the expected behavior.'
add_comment "$review" '| Table' \
  'Table comment: verify the status and owner values.' --as-bot
add_comment "$review" 'const state: PreviewState = "ready";' \
  'Code comment: consider how failures should be represented.'
add_comment "$review" '## Mermaid Diagrams' \
  'Diagram comment: check Mermaid rendering and zoom controls.'
sadoku instruction add --source "$review" \
  --content 'Check that the document explains the workflow clearly enough for users to follow.' >/dev/null
sadoku instruction add --source "$review" \
  --content 'Include a reason and a concrete example with each suggestion.' >/dev/null
sadoku memory add --source "$review" \
  --content 'This document is for preview checks. Try editing, replying to, and resolving comments.' >/dev/null
sadoku memory add --source "$review" \
  --content 'Reviews may include both human and bot participants.' >/dev/null

changes="$documents/second.md"
add_comment "$changes" 'This is a second Markdown fixture for checking document selection in directory' \
  'Created before the introduction changed. Compare the current text with the original quote.'
add_comment "$changes" '- Add a comment to confirm comments remain scoped to this document.' \
  'This list item moved after new lines were inserted. Check that the comment still points to it.'
add_comment "$changes" '- Edit this line to confirm document-scoped hot reload works.' \
  'The list item this comment referred to was deleted. Check the saved quote.'
add_comment "$changes" 'const documentName = "second.md";' \
  'Resolved before the document changed. Check the source diff and resolved state.' --as-bot
sadoku comment resolve 4 --source "$changes" --as-bot >/dev/null
# Edit only the copied fixture, then advance snapshots through the normal CLI.
awk '
  $0 == "# Second Document" {
    print
    print ""
    print "This copy was updated before startup to demonstrate review changes."
    next
  }
  $0 == "This is a second Markdown fixture for checking document selection in directory" {
    print "This is an updated Markdown fixture for checking review workflows in directory"
    next
  }
  $0 == "- Edit this line to confirm document-scoped hot reload works." { next }
  { print }
' "$changes" > "$changes.updated"
mv "$changes.updated" "$changes"
sadoku comment list --source "$changes" >/dev/null

archived="$documents/guides/overview.md"
add_comment "$archived" 'This document is a first-level nested fixture for directory preview mode.' \
  'Created before the document was deleted. Read this comment alongside the saved snapshot.'
add_comment "$archived" '# Guide Overview' \
  'Bot comment retained on a deleted document.' --as-bot
sadoku memory add --source "$archived" \
  --content 'The copied file is deleted during sample preparation to demonstrate saved document snapshots.' >/dev/null
rm "$archived"

add_comment "$documents/japanese.md" '# ' \
  'Comment on the Japanese fixture: compare text size and line wrapping.'
add_comment "$documents/japanese.md" '0123456789' \
  'Check digit readability and compare half-width and full-width numbers.' --as-bot
