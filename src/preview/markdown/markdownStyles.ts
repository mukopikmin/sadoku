export const markdownStyles = `
  :root {
    color-scheme: light dark;
  }

  .comment-markdown-list > .task-list-item {
    list-style-type: none;
  }

  .markdown-preview .commentable-list-item > .commentable-content {
    padding-block: calc(var(--chakra-spacing-1) / 2);
  }

  .markdown-code-block {
    color: var(--chakra-colors-code-fg);
    white-space: pre;
  }

  :root[data-code-wrap="wrap"] .markdown-code-block {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .comment-body-markdown {
    overflow-wrap: anywhere;
  }

  .comment-body-markdown > :last-child,
  .comment-body-markdown > :last-child > :last-child {
    margin-bottom: 0;
  }

  .comment-markdown-body :where(th, td) {
    border: 1px solid var(--chakra-colors-border-default);
    padding: var(--chakra-spacing-2) var(--chakra-spacing-3);
  }

  .comment-markdown-body th {
    font-weight: 600;
  }

  .comment-markdown-body tr {
    border-top: 1px solid var(--chakra-colors-border-muted);
  }

  .markdown-preview {
    display: flex;
    flex-direction: column;
    gap: var(--chakra-spacing-3);
    isolation: isolate;
    position: relative;
  }

  .markdown-range-highlights {
    inset: 0;
    pointer-events: none;
    position: absolute;
    z-index: -1;
  }

  :root[data-show-highlight-boundaries="true"] .markdown-range-highlight,
  :root[data-show-highlight-boundaries="true"] .commentable-content::before {
    outline: 1px solid var(--chakra-colors-accent);
    outline-offset: -1px;
  }

  .markdown-range-highlight {
    border-radius: var(--chakra-radii-sm);
    left: calc(-1 * var(--chakra-spacing-2));
    position: absolute;
    right: calc(-1 * var(--chakra-spacing-2));
  }

  .markdown-preview [data-revision-kind="addition"] {
    --markdown-highlight-bg: var(--chakra-colors-highlight-addition-bg);
  }

  .markdown-preview [data-revision-kind="deletion"] {
    --markdown-highlight-bg: var(--chakra-colors-highlight-deletion-bg);
  }

  .markdown-preview [data-revision-kind] :where([data-markdown-code-block], pre.mermaid) {
    background: var(--markdown-highlight-bg);
  }

  .markdown-preview [data-revision-kind] pre.mermaid > svg {
    background-color: transparent !important;
  }

  .commentable-content {
    box-sizing: border-box;
    cursor: pointer;
    isolation: isolate;
    position: relative;
    width: 100%;
  }

  .commentable-block {
    margin: 0;
  }

  .commentable-list-item {
    display: contents;
  }

  .commentable-list-item > .commentable-content {
    display: block;
    isolation: auto;
  }

  .comment-markdown-list > li {
    isolation: isolate;
    position: relative;
  }

  .comment-markdown-body {
    display: contents;
  }

  /* Individual block bounds are shown only by the boundary debug setting. */
  .commentable-content::before {
    content: "";
    position: absolute;
    z-index: -1;
    top: 0;
    right: calc(-1 * var(--chakra-spacing-2));
    bottom: 0;
    left: calc(-1 * var(--chakra-spacing-2) - var(--comment-indent-offset, 0em));
    border-radius: var(--chakra-radii-sm);
    background: var(--chakra-colors-transparent);
    pointer-events: none;
  }

  /* Let the shared block/range highlight show through opaque Markdown surfaces. */
  .markdown-preview :is(
    .commentable-block:hover > .commentable-content,
    .commentable-block:focus-within > .commentable-content,
    .commentable-block-selected > .commentable-content,
    .commentable-block-highlighted > .commentable-content,
    .commentable-block:has(.comment-thread) > .commentable-content,
    [data-revision-kind]
  ) :is(thead, pre, .code-block__root) {
    background: transparent;
  }

  .comment-thread {
    margin: var(--chakra-spacing-2) 0 var(--chakra-spacing-3);
    margin-left: calc(0em - var(--comment-indent-offset, 0em));
  }

  .document-diff-addition,
  .document-diff-deletion {
    display: flex;
    flex-direction: column;
    gap: var(--chakra-spacing-3);
  }

  .document-diff-addition {
    background: var(--chakra-colors-highlight-addition-bg);
  }

  .document-diff-deletion {
    background: var(--chakra-colors-highlight-deletion-bg);
  }

  [data-document-diff] .comment-thread {
    background: var(--chakra-colors-canvas);
  }

  /* All interaction states share the padding-inclusive overlay geometry. */
  [data-document-diff] .markdown-range-highlight-comment {
    background: transparent;
    outline: 1px solid var(--chakra-colors-selection-comment);
    outline-offset: -1px;
  }

  [data-document-diff] .markdown-range-highlight-selection,
  [data-document-diff] .markdown-range-highlight-hover {
    background: transparent;
    outline: 2px solid var(--chakra-colors-accent);
    outline-offset: -2px;
  }

  [data-document-diff] > .markdown-range-highlights {
    z-index: 1;
  }

  .mermaid-container .mermaid {
    margin-bottom: 0;
  }

  .mermaid {
    overflow: auto;
    border: 1px solid var(--chakra-colors-border-muted);
    border-radius: var(--chakra-radii-sm);
    padding: var(--chakra-spacing-4);
    background: var(--chakra-colors-canvas-subtle);
    color: var(--chakra-colors-fg);
  }

  /* Mermaid sets an inline SVG background; use its highlighted container instead. */
  .mermaid > svg {
    background: inherit !important;
  }

  .mermaid-zoom-stage {
    display: grid;
    place-items: center;
  }

  .mermaid-zoom-stage > svg {
    display: block;
    width: var(--mermaid-pinch-width, 100%) !important;
    height: var(--mermaid-pinch-height, auto) !important;
    max-width: none !important;
    max-height: none !important;
  }
`;
