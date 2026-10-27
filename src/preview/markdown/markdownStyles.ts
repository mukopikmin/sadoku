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
