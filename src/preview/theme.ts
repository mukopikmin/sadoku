import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

export const sadokuChakraSystem = createSystem(
  defaultConfig,
  defineConfig({
    globalCss: {
      body: {
        bg: "canvas",
        color: "fg",
        fontFamily: "body",
        lineHeight: "1.65",
        margin: 0,
      },
    },
    theme: {
      tokens: {
        colors: {
          accent: { value: "#0969da" },
          canvas: { value: "#ffffff" },
          "canvas.subtle": { value: "#f6f8fa" },
          "border.default": { value: "#d0d7de" },
          "border.muted": { value: "#d8dee4" },
          "code.bg": { value: "#818b981f" },
          "code.fg": { value: "#032f62" },
          "fg.default": { value: "#1f2328" },
          "fg.muted": { value: "#59636e" },
          "link.default": { value: "#0969da" },
          "warning.fg": { value: "#9a6700" },
        },
        fonts: {
          body: {
            value:
              '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", "Noto Sans CJK JP", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
          },
          mono: {
            value:
              '"JetBrains Mono", "Fira Code", "Cascadia Code", "SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", Menlo, Monaco, "UDEV Gothic", "BIZ UDGothic", "Noto Sans Mono CJK JP", monospace',
          },
        },
      },
      semanticTokens: {
        colors: {
          accent: { value: { _dark: "#2f81f7", base: "#0969da" } },
          canvas: { value: { _dark: "#0d1117", base: "#ffffff" } },
          "canvas.subtle": { value: { _dark: "#161b22", base: "#f6f8fa" } },
          "border.default": { value: { _dark: "#30363d", base: "#d0d7de" } },
          "border.muted": { value: { _dark: "#21262d", base: "#d8dee4" } },
          "code.bg": { value: { _dark: "#6e768166", base: "#818b981f" } },
          "code.fg": { value: { _dark: "#79c0ff", base: "#032f62" } },
          fg: { value: { _dark: "#e6edf3", base: "#1f2328" } },
          "fg.muted": { value: { _dark: "#8b949e", base: "#59636e" } },
          link: { value: { _dark: "#58a6ff", base: "#0969da" } },
          "warning.fg": { value: "#9a6700" },
        },
      },
    },
  }),
);

export const previewThemeCss = `
      :root {
        color-scheme: light dark;
        --color-canvas: #ffffff;
        --color-canvas-subtle: #f6f8fa;
        --color-border: #d0d7de;
        --color-border-muted: #d8dee4;
        --color-text: #1f2328;
        --color-text-muted: #59636e;
        --color-link: #0969da;
        --color-code-bg: #818b981f;
        --color-accent: #0969da;
        font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", "Noto Sans CJK JP", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        line-height: 1.65;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --color-canvas: #0d1117;
          --color-canvas-subtle: #161b22;
          --color-border: #30363d;
          --color-border-muted: #21262d;
          --color-text: #e6edf3;
          --color-text-muted: #8b949e;
          --color-link: #58a6ff;
          --color-code-bg: #6e768166;
          --color-accent: #2f81f7;
        }
      }

      .comment-markdown-body .task-list-item {
        list-style-type: none;
      }

      .comment-markdown-body .task-list-item-checkbox {
        margin: 0 0.5em 0.2em 0;
        vertical-align: middle;
      }

      .hljs {
        color: var(--chakra-colors-code\\.fg);
      }

      .hljs-comment,
      .hljs-quote {
        color: #4b5563;
      }

      .hljs-keyword,
      .hljs-selector-tag,
      .hljs-subst {
        color: #8b0000;
      }

      .hljs-literal,
      .hljs-number,
      .hljs-tag .hljs-attr,
      .hljs-template-variable,
      .hljs-variable {
        color: #7a3e00;
      }

      .hljs-doctag,
      .hljs-string,
      .hljs-title,
      .hljs-section,
      .hljs-selector-id {
        color: #005a00;
      }

      .hljs-type,
      .hljs-class .hljs-title,
      .hljs-built_in,
      .hljs-builtin-name {
        color: #003c8f;
      }

      .hljs-attr,
      .hljs-attribute,
      .hljs-name,
      .hljs-selector-class,
      .hljs-selector-attr,
      .hljs-selector-pseudo {
        color: #005a00;
      }

      .hljs-symbol,
      .hljs-bullet,
      .hljs-link,
      .hljs-meta {
        color: #4c1d95;
      }

      .hljs-deletion {
        color: #82071e;
        background: #ffebe9;
      }

      .hljs-addition {
        color: #116329;
        background: #dafbe1;
      }

      @media (prefers-color-scheme: dark) {
        .hljs-keyword,
        .hljs-selector-tag,
        .hljs-subst {
          color: #ff7b72;
        }

        .hljs-literal,
        .hljs-number,
        .hljs-tag .hljs-attr,
        .hljs-template-variable,
        .hljs-variable {
          color: #ffa657;
        }

        .hljs-doctag,
        .hljs-string,
        .hljs-title,
        .hljs-section,
        .hljs-selector-id {
          color: #a5d6ff;
        }

        .hljs-type,
        .hljs-class .hljs-title,
        .hljs-built_in,
        .hljs-builtin-name {
          color: #d2a8ff;
        }

        .hljs-attr,
        .hljs-attribute,
        .hljs-name,
        .hljs-selector-class,
        .hljs-selector-attr,
        .hljs-selector-pseudo {
          color: #7ee787;
        }

        .hljs-symbol,
        .hljs-bullet,
        .hljs-link,
        .hljs-meta {
          color: #79c0ff;
        }

        .hljs-deletion {
          color: #ffdcd7;
          background: #67060c;
        }

        .hljs-addition {
          color: #aff5b4;
          background: #033a16;
        }
      }

      .comment-markdown-body table {
        display: block;
        overflow: auto;
        width: max-content;
        max-width: 100%;
        border-spacing: 0;
        border-collapse: collapse;
      }

      .comment-markdown-body :where(th, td) {
        border: 1px solid var(--color-border);
        padding: 6px 13px;
      }

      .comment-markdown-body th {
        font-weight: 600;
      }

      .comment-markdown-body tr {
        border-top: 1px solid var(--color-border-muted);
      }

      .commentable-content {
        box-sizing: border-box;
        cursor: pointer;
        isolation: isolate;
        position: relative;
        width: 100%;
      }

      .commentable-list-item {
        display: contents;
      }

      .commentable-list-item > .commentable-content {
        display: block;
      }

      .comment-markdown-body {
        display: contents;
      }

      .commentable-content::before {
        content: "";
        position: absolute;
        z-index: -1;
        inset: -4px -8px;
        border-radius: 6px;
        background: transparent;
        pointer-events: none;
        transition: background-color 120ms ease;
      }

      .commentable-block:has(.comment-thread) > .commentable-content::before {
        background: color-mix(in srgb, var(--color-accent) 8%, transparent);
      }

      .commentable-block:hover > .commentable-content::before,
      .commentable-block:focus-within > .commentable-content::before {
        background: color-mix(in srgb, var(--color-accent) 14%, transparent);
      }

      .commentable-block-comment-highlight > .commentable-content::before {
        background: color-mix(in srgb, #d29922 18%, transparent);
      }

      .commentable-block-range-selected > .commentable-content::before {
        background: color-mix(in srgb, var(--color-accent) 18%, transparent);
      }

      .comment-selection-button {
        position: absolute;
        z-index: 1;
        top: 0;
        right: 0;
      }

      .comment-thread {
        margin: -6px 0 12px;
        border-left: 3px solid var(--color-accent);
        padding: 6px 0 1px 10px;
      }

      .commentable-list-item > .comment-thread {
        margin: 6px 0 12px;
      }

      .mermaid-container {
        position: relative;
        margin-bottom: 16px;
      }

      .mermaid-container .mermaid {
        margin-bottom: 0;
      }

      .mermaid {
        overflow: auto;
        border: 1px solid var(--color-border-muted);
        border-radius: 6px;
        padding: 16px;
        background: var(--color-canvas-subtle);
        color: var(--color-text);
      }

      .mermaid-zoom-button {
        position: absolute;
        top: 8px;
        right: 8px;
        background: var(--color-canvas);
        color: var(--color-text);
      }

      .mermaid-zoom-close:hover,
      .mermaid-zoom-close:focus-visible {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .mermaid-zoom-dialog {
        position: fixed;
        z-index: 1000;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 16px;
      }

      .mermaid-zoom-backdrop {
        position: absolute;
        inset: 0;
        background: rgb(0 0 0 / 0.62);
      }

      .mermaid-zoom-content {
        position: relative;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        width: var(--mermaid-zoom-width, calc(100vw - 32px));
        height: var(--mermaid-zoom-height, calc(100vh - 32px));
        overflow: hidden;
        border: 0;
        border-radius: 8px;
        padding: 0;
        background: var(--color-canvas);
        box-shadow:
          0 0 0 1px var(--color-border),
          0 16px 48px rgb(0 0 0 / 0.32);
      }

      .mermaid-zoom-close {
        position: absolute;
        z-index: 1;
        top: 8px;
        right: 8px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-canvas);
        color: var(--color-text);
        cursor: pointer;
        font: inherit;
        font-size: 1.1rem;
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
