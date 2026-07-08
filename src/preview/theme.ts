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


      .comment-markdown-body h1 {
        font-size: 2rem;
      }

      .comment-markdown-body :where(h1, h2) {
        padding-bottom: 0.3em;
        border-bottom: 1px solid var(--color-border-muted);
      }

      .comment-markdown-body :where(h1, h2, h3, h4, h5, h6) {
        line-height: 1.25;
        margin: 24px 0 16px;
        font-weight: 600;
      }

      .comment-markdown-body h2 {
        font-size: 1.5rem;
      }

      .comment-markdown-body h3 {
        font-size: 1.25rem;
      }

      .comment-markdown-body h4 {
        font-size: 1rem;
      }

      .comment-markdown-body h5 {
        font-size: 0.875rem;
      }

      .comment-markdown-body h6 {
        color: var(--color-text-muted);
        font-size: 0.85rem;
      }

      .comment-markdown-body :where(h1:first-child, h2:first-child, h3:first-child) {
        margin-top: 0;
      }

      .comment-markdown-body :where(p, blockquote, ul, ol, dl, table, pre) {
        margin-top: 0;
        margin-bottom: 16px;
      }

      .comment-markdown-list {
        margin-top: 8px;
        margin-bottom: 16px;
      }

      .comment-markdown-body a {
        color: var(--color-link);
        text-decoration: none;
      }

      .comment-markdown-body a:hover {
        text-decoration: underline;
      }

      .comment-markdown-body .heading-anchor {
        color: inherit;
        text-decoration: none;
      }

      .comment-markdown-body img {
        max-width: 100%;
        height: auto;
      }

      .comment-markdown-body li + li {
        margin-top: 0.25em;
      }

      .comment-markdown-body li > :where(ul, ol) {
        margin-top: 0.25em;
        margin-bottom: 0;
      }

      li > .comment-markdown-list {
        margin-top: 0.25em;
        margin-bottom: 0;
      }

      .comment-markdown-body .task-list-item {
        list-style-type: none;
      }

      .comment-markdown-body .task-list-item-checkbox {
        margin: 0 0.5em 0.2em 0;
        vertical-align: middle;
      }

      .comment-markdown-body code {
        border-radius: 6px;
        padding: 0.2em 0.4em;
        background: var(--color-code-bg);
        font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", "SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", Menlo, Monaco, "UDEV Gothic", "BIZ UDGothic", "Noto Sans Mono CJK JP", monospace;
        font-size: 0.85em;
      }

      .comment-markdown-body pre {
        overflow: auto;
        border: 1px solid var(--color-border-muted);
        border-radius: 6px;
        padding: 16px;
        background: var(--color-canvas-subtle);
        line-height: 1.45;
      }

      .comment-markdown-body pre code {
        padding: 0;
        background: transparent;
        font-size: 0.85rem;
      }

      .hljs {
        color: var(--color-text);
      }

      .hljs-comment,
      .hljs-quote {
        color: var(--color-text-muted);
      }

      .hljs-keyword,
      .hljs-selector-tag,
      .hljs-subst {
        color: #cf222e;
      }

      .hljs-literal,
      .hljs-number,
      .hljs-tag .hljs-attr,
      .hljs-template-variable,
      .hljs-variable {
        color: #953800;
      }

      .hljs-doctag,
      .hljs-string,
      .hljs-title,
      .hljs-section,
      .hljs-selector-id {
        color: #0a3069;
      }

      .hljs-type,
      .hljs-class .hljs-title,
      .hljs-built_in,
      .hljs-builtin-name {
        color: #8250df;
      }

      .hljs-attr,
      .hljs-attribute,
      .hljs-name,
      .hljs-selector-class,
      .hljs-selector-attr,
      .hljs-selector-pseudo {
        color: #116329;
      }

      .hljs-symbol,
      .hljs-bullet,
      .hljs-link,
      .hljs-meta {
        color: #0969da;
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

      .comment-markdown-body hr {
        height: calc(1px + 16px);
        margin: 24px 0;
        border: 0;
        background: linear-gradient(var(--color-border-muted), var(--color-border-muted)) center / 100% 1px no-repeat;
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
        padding: 24px;
      }

      .mermaid-zoom-backdrop {
        position: absolute;
        inset: 0;
        background: rgb(0 0 0 / 0.62);
      }

      .mermaid-zoom-content {
        position: relative;
        box-sizing: border-box;
        max-width: min(1200px, 96vw);
        max-height: 92vh;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 44px 16px 16px;
        background: var(--color-canvas);
        box-shadow: 0 16px 48px rgb(0 0 0 / 0.32);
      }

      .mermaid-zoom-close {
        position: absolute;
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
        max-width: calc(96vw - 32px);
        max-height: calc(92vh - 60px);
        overflow: auto;
      }

      .mermaid-zoom-scroller svg {
        display: block;
        max-width: none;
        max-height: none;
      }

`;
