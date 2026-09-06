export const markdownStyles = `
  :root {
    color-scheme: light dark;
  }

  .comment-markdown-list > .task-list-item {
    list-style-type: none;
  }

  .markdown-preview .comment-markdown-list > li + li > .commentable-list-item > .commentable-content {
    padding-top: var(--chakra-spacing-1);
  }

  .hljs {
    color: var(--chakra-colors-code-fg);
  }

  .markdown-code-block {
    white-space: pre;
  }

  :root[data-code-wrap="wrap"] .markdown-code-block {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .hljs-comment,
  .hljs-quote {
    color: var(--chakra-colors-syntax-comment);
  }

  .hljs-keyword,
  .hljs-selector-tag,
  .hljs-subst {
    color: var(--chakra-colors-syntax-keyword);
  }

  .hljs-literal,
  .hljs-number,
  .hljs-tag .hljs-attr,
  .hljs-template-variable,
  .hljs-variable {
    color: var(--chakra-colors-syntax-literal);
  }

  .hljs-doctag,
  .hljs-string,
  .hljs-title,
  .hljs-section,
  .hljs-selector-id {
    color: var(--chakra-colors-syntax-string);
  }

  .hljs-type,
  .hljs-class .hljs-title,
  .hljs-built_in,
  .hljs-builtin-name {
    color: var(--chakra-colors-syntax-type);
  }

  .hljs-attr,
  .hljs-attribute,
  .hljs-name,
  .hljs-selector-class,
  .hljs-selector-attr,
  .hljs-selector-pseudo {
    color: var(--chakra-colors-syntax-attribute);
  }

  .hljs-symbol,
  .hljs-bullet,
  .hljs-link,
  .hljs-meta {
    color: var(--chakra-colors-syntax-meta);
  }

  .hljs-deletion {
    color: var(--chakra-colors-syntax-deletion-fg);
    background: var(--chakra-colors-syntax-deletion-bg);
  }

  .hljs-addition {
    color: var(--chakra-colors-syntax-addition-fg);
    background: var(--chakra-colors-syntax-addition-bg);
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

  .markdown-range-highlight {
    border-radius: var(--chakra-radii-sm);
    left: calc(-1 * var(--chakra-spacing-2));
    position: absolute;
    right: calc(-1 * var(--chakra-spacing-2));
  }

  .markdown-range-highlight-comment {
    background: color-mix(in srgb, var(--chakra-colors-selection-comment) 18%, var(--chakra-colors-canvas));
  }

  .markdown-range-highlight-selection {
    background: color-mix(
      in srgb,
      var(--chakra-colors-accent) 18%,
      var(--chakra-colors-canvas)
    );
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
    transition: background-color 120ms ease;
  }

  .commentable-block:not(.commentable-block-selected):not(.commentable-block-continuous-highlight):has(.comment-thread) > .commentable-content::before {
    background: color-mix(in srgb, var(--chakra-colors-accent) 8%, var(--chakra-colors-canvas));
  }

  .commentable-block:not(.commentable-block-selected):not(.commentable-block-continuous-highlight):has(.comment-thread) > .commentable-content pre {
    background: color-mix(in srgb, var(--chakra-colors-accent) 8%, var(--chakra-colors-canvas));
  }

  .commentable-block:not(.commentable-block-selected):hover > .commentable-content::before,
  .commentable-block:not(.commentable-block-selected):focus-within > .commentable-content::before {
    background: color-mix(in srgb, var(--chakra-colors-accent) 14%, var(--chakra-colors-canvas));
  }

  .commentable-block:not(.commentable-block-selected):hover > .commentable-content pre,
  .commentable-block:not(.commentable-block-selected):focus-within > .commentable-content pre {
    background: color-mix(in srgb, var(--chakra-colors-accent) 14%, var(--chakra-colors-canvas));
  }

  .commentable-block-comment-highlight > .commentable-content::before {
    background: color-mix(in srgb, var(--chakra-colors-selection-comment) 18%, var(--chakra-colors-canvas));
  }

  .commentable-block-range-selected > .commentable-content::before {
    background: color-mix(in srgb, var(--chakra-colors-accent) 18%, var(--chakra-colors-canvas));
  }

  .commentable-block-comment-highlight > .commentable-content pre {
    background: color-mix(in srgb, var(--chakra-colors-selection-comment) 18%, var(--chakra-colors-canvas));
  }

  .commentable-block-range-selected > .commentable-content pre {
    background: color-mix(in srgb, var(--chakra-colors-accent) 18%, var(--chakra-colors-canvas));
  }

  .comment-thread {
    margin: var(--chakra-spacing-2) 0 var(--chakra-spacing-3);
    margin-left: calc(0em - var(--comment-indent-offset, 0em));
    border-left: 3px solid var(--chakra-colors-accent);
    padding: var(--chakra-spacing-2) 0 1px var(--chakra-spacing-3);
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

  .mermaid-zoom-close:hover,
  .mermaid-zoom-close:focus-visible {
    border-color: var(--chakra-colors-accent);
    color: var(--chakra-colors-accent);
  }

  .mermaid-zoom-dialog {
    position: fixed;
    z-index: 1000;
    inset: 0;
    display: grid;
    place-items: center;
    padding: var(--chakra-spacing-4);
  }

  .mermaid-zoom-backdrop {
    position: absolute;
    inset: 0;
    background: var(--chakra-colors-overlay-backdrop);
  }

  .mermaid-zoom-content {
    position: relative;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: var(--mermaid-zoom-width, calc(100vw - var(--chakra-spacing-8)));
    height: var(--mermaid-zoom-height, calc(100vh - var(--chakra-spacing-8)));
    overflow: hidden;
    border: 0;
    border-radius: var(--chakra-radii-md);
    padding: 0;
    background: var(--chakra-colors-canvas);
    box-shadow:
      0 0 0 1px var(--chakra-colors-border-default),
      0 var(--chakra-spacing-4) var(--chakra-spacing-12) var(--chakra-colors-overlay-shadow);
  }

  .mermaid-zoom-close {
    position: absolute;
    z-index: 1;
    top: var(--chakra-spacing-2);
    right: var(--chakra-spacing-2);
    border: 1px solid var(--chakra-colors-border-default);
    border-radius: var(--chakra-radii-sm);
    background: var(--chakra-colors-canvas);
    color: var(--chakra-colors-fg);
    cursor: pointer;
    font: inherit;
    font-size: 1rem;
    line-height: 1;
  }

  .mermaid-zoom-scroller {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }

  .mermaid-zoom-scroller svg {
    display: block;
    width: 100%;
    height: auto;
    max-width: none !important;
    max-height: none !important;
  }
`;
