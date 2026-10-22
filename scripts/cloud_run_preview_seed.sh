#!/bin/sh
set -eu

# Called only by the preview entrypoint, with a fresh, isolated directory.
script_dir="$(CDPATH= cd "$(dirname "$0")" && pwd)"
sample_dir="$script_dir/preview_samples"
documents="$1/documents"

mkdir -p "$documents/examples"
cp "$sample_dir/documents/"*.md "$documents/"
cp "$script_dir/../test/integration/fixtures/comprehensive.md" "$documents/examples/"
cp "$script_dir/../test/integration/fixtures/japanese.md" "$documents/examples/"

for document in "$documents/"*.md "$documents/examples/"*.md; do
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

review="$documents/01-review.md"
add_comment "$review" '利用者はMarkdownを読み、気になる箇所にコメントを残せます。' \
  '未解決コメントのサンプルです。この説明に利用者の具体例を追加してください。'
add_comment "$review" 'レビュー結果は文書ごとに整理します。' \
  'botの指摘です。レビュー結果の保存先を明記してください。' --as-bot
sadoku comment reply add --source "$review" --comment 2 \
  --body '文書ごとの保存先を確認しました。補足を追記する予定です。' >/dev/null
sadoku comment reply add --source "$review" --comment 2 --as-bot --request-review \
  --body '補足内容を確認してください。再レビュー依頼の表示サンプルです。' >/dev/null
add_comment "$review" '解決した指摘も後から読み返せます。' \
  '解決済みコメントのサンプルです。必要なら再度開いてください。'
sadoku comment reply add --source "$review" --comment 3 \
  --body '確認できたので、この指摘は解決します。' >/dev/null
sadoku comment resolve 3 --source "$review" >/dev/null
add_comment "$review" '- [ ] 手順の説明を確認する' \
  'チェックリストへのコメントです。手順を実際に試してください。'
add_comment "$review" '| レビュー' \
  '表の行へのコメントです。担当者と進捗を確認してください。' --as-bot
add_comment "$review" 'const status = "ready";' \
  'コードへのコメントです。失敗時の状態も検討してください。'
sadoku instruction add --source "$review" \
  --content 'レビューでは、利用者が迷わず操作できる説明になっているかを確認してください。' >/dev/null
sadoku instruction add --source "$review" \
  --content '指摘には理由と具体的な修正例を添えてください。' >/dev/null
sadoku memory add --source "$review" \
  --content 'この文書はpreviewの操作確認用です。コメントの編集・返信・解決を自由に試せます。' >/dev/null
sadoku memory add --source "$review" \
  --content 'レビュー担当は人とbotの両方を想定しています。' >/dev/null

changes="$documents/02-changes.md"
add_comment "$changes" '応答時間の目標は200 msです。' \
  '目標値の変更前に付けたコメントです。現在の本文と引用を比較してください。'
add_comment "$changes" 'この段落は変更せず、位置だけが移動します。' \
  '本文への行追加後も、このコメントが同じ段落を指すことを確認してください。'
add_comment "$changes" '旧画面から設定を変更してください。' \
  '削除された段落へのコメントです。削除された引用の表示を確認してください。'
add_comment "$changes" '変更履歴とコメントを合わせて確認します。' \
  '変更前に解決した指摘です。差分と解決済み表示を確認してください。' --as-bot
sadoku comment resolve 4 --source "$changes" --as-bot >/dev/null
# Advance the snapshots through the normal CLI after replacing the live source.
cp "$sample_dir/02-changes-after.md" "$changes"
sadoku comment list --source "$changes" >/dev/null

archived="$documents/03-archived.md"
add_comment "$archived" '削除後も保存された本文とコメントを確認できます。' \
  '文書削除前に残したコメントです。保存された本文と一緒に読めます。'
add_comment "$archived" 'この文書はサーバー起動前に削除されます。' \
  '削除済み文書に残るbotコメントのサンプルです。' --as-bot
sadoku memory add --source "$archived" \
  --content '削除された文書の表示を確認するため、サンプル準備の最後にファイルを削除しています。' >/dev/null
rm "$archived"

add_comment "$documents/examples/comprehensive.md" '# Comprehensive Document' \
  'Markdown表示の確認用です。表・コード・Mermaidをスクロールして確認してください。'
add_comment "$documents/examples/japanese.md" '# 日本語ドキュメントの表示サンプル' \
  '日本語のコメントです。本文とコメントの文字サイズ・改行を確認してください。'
add_comment "$documents/examples/japanese.md" '半角：0123456789' \
  '数字の読みやすさを確認してください。全角数字との比較もできます。' --as-bot
