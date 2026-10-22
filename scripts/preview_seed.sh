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
  sadoku document add "$document" >/dev/null
done

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
  '未解決コメントのサンプルです。各Markdown要素の表示を確認してください。'
add_comment "$review" 'Text before a subheading.' \
  'botの指摘です。見出し前の説明を補足してください。' --as-bot
sadoku comment reply add --source "$review" --comment 2 \
  --body '文書ごとの保存先を確認しました。補足を追記する予定です。' >/dev/null
sadoku comment reply add --source "$review" --comment 2 --as-bot --request-review \
  --body '補足内容を確認してください。再レビュー依頼の表示サンプルです。' >/dev/null
add_comment "$review" 'Paragraph after simple nested lists.' \
  '解決済みコメントのサンプルです。必要なら再度開いてください。'
sadoku comment reply add --source "$review" --comment 3 \
  --body '確認できたので、この指摘は解決します。' >/dev/null
sadoku comment resolve 3 --source "$review" >/dev/null
add_comment "$review" '- [ ] unchecked task' \
  'チェックリストへのコメントです。手順を実際に試してください。'
add_comment "$review" '| Table' \
  '表の行へのコメントです。担当者と進捗を確認してください。' --as-bot
add_comment "$review" 'const state: PreviewState = "ready";' \
  'コードへのコメントです。失敗時の状態も検討してください。'
add_comment "$review" '## Mermaid Diagrams' \
  '図へのコメントです。Mermaidの表示や拡大操作を確認してください。'
sadoku instruction add --source "$review" \
  --content 'レビューでは、利用者が迷わず操作できる説明になっているかを確認してください。' >/dev/null
sadoku instruction add --source "$review" \
  --content '指摘には理由と具体的な修正例を添えてください。' >/dev/null
sadoku memory add --source "$review" \
  --content 'この文書はpreviewの操作確認用です。コメントの編集・返信・解決を自由に試せます。' >/dev/null
sadoku memory add --source "$review" \
  --content 'レビュー担当は人とbotの両方を想定しています。' >/dev/null

changes="$documents/second.md"
add_comment "$changes" 'This is a second Markdown fixture for checking document selection in directory' \
  '導入文の変更前に付けたコメントです。現在の本文と引用を比較してください。'
add_comment "$changes" '- Add a comment to confirm comments remain scoped to this document.' \
  '本文への行追加後も、このコメントが同じ箇条書きを指すことを確認してください。'
add_comment "$changes" '- Edit this line to confirm document-scoped hot reload works.' \
  '削除された箇条書きへのコメントです。削除された引用の表示を確認してください。'
add_comment "$changes" 'const documentName = "second.md";' \
  '変更前に解決した指摘です。差分と解決済み表示を確認してください。' --as-bot
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
  '文書削除前に残したコメントです。保存された本文と一緒に読めます。'
add_comment "$archived" '# Guide Overview' \
  '削除済み文書に残るbotコメントのサンプルです。' --as-bot
sadoku memory add --source "$archived" \
  --content '削除された文書の表示を確認するため、サンプル準備の最後にファイルを削除しています。' >/dev/null
rm "$archived"

add_comment "$documents/japanese.md" '# 日本語ドキュメントの表示サンプル' \
  '日本語のコメントです。本文とコメントの文字サイズ・改行を確認してください。'
add_comment "$documents/japanese.md" '半角：0123456789' \
  '数字の読みやすさを確認してください。全角数字との比較もできます。' --as-bot
