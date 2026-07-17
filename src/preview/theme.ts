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
          accent: {
            value: { _dark: "{colors.blue.400}", base: "{colors.blue.600}" },
          },
          canvas: {
            DEFAULT: {
              value: { _dark: "{colors.gray.950}", base: "{colors.white}" },
            },
            subtle: {
              value: { _dark: "{colors.gray.900}", base: "{colors.gray.50}" },
            },
          },
          border: {
            default: {
              value: { _dark: "{colors.gray.700}", base: "{colors.gray.300}" },
            },
            muted: {
              value: { _dark: "{colors.gray.800}", base: "{colors.gray.200}" },
            },
          },
          code: {
            bg: {
              value: { _dark: "{colors.gray.800}", base: "{colors.gray.100}" },
            },
            fg: {
              value: { _dark: "{colors.blue.300}", base: "{colors.blue.900}" },
            },
          },
          fg: {
            DEFAULT: {
              value: { _dark: "{colors.gray.100}", base: "{colors.gray.950}" },
            },
            muted: {
              value: { _dark: "{colors.gray.400}", base: "{colors.gray.600}" },
            },
          },
          link: {
            value: { _dark: "{colors.blue.400}", base: "{colors.blue.600}" },
          },
          overlay: {
            backdrop: { value: "{colors.blackAlpha.600}" },
            shadow: { value: "{colors.blackAlpha.300}" },
          },
          selection: {
            comment: {
              value: {
                _dark: "{colors.yellow.400}",
                base: "{colors.yellow.600}",
              },
            },
          },
          syntax: {
            addition: {
              bg: {
                value: {
                  _dark: "{colors.green.950}",
                  base: "{colors.green.100}",
                },
              },
              fg: {
                value: {
                  _dark: "{colors.green.100}",
                  base: "{colors.green.800}",
                },
              },
            },
            attribute: {
              value: {
                _dark: "{colors.green.300}",
                base: "{colors.green.800}",
              },
            },
            comment: {
              value: { _dark: "{colors.gray.400}", base: "{colors.gray.600}" },
            },
            deletion: {
              bg: {
                value: { _dark: "{colors.red.950}", base: "{colors.red.100}" },
              },
              fg: {
                value: { _dark: "{colors.red.100}", base: "{colors.red.800}" },
              },
            },
            keyword: {
              value: { _dark: "{colors.red.400}", base: "{colors.red.800}" },
            },
            literal: {
              value: {
                _dark: "{colors.orange.300}",
                base: "{colors.orange.800}",
              },
            },
            meta: {
              value: {
                _dark: "{colors.blue.300}",
                base: "{colors.purple.800}",
              },
            },
            string: {
              value: { _dark: "{colors.blue.200}", base: "{colors.green.800}" },
            },
            type: {
              value: {
                _dark: "{colors.purple.300}",
                base: "{colors.blue.800}",
              },
            },
          },
          warning: {
            fg: {
              value: {
                _dark: "{colors.yellow.400}",
                base: "{colors.yellow.700}",
              },
            },
          },
        },
      },
    },
  }),
);

export const previewThemeCss = `
      :root {
        color-scheme: light dark;
        font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", "Noto Sans CJK JP", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        line-height: 1.65;
      }

      :root,
      :root[data-theme="light"] {
        --chakra-colors-accent: var(--chakra-colors-blue-600);
        --chakra-colors-canvas: var(--chakra-colors-white);
        --chakra-colors-canvas-subtle: var(--chakra-colors-gray-50);
        --chakra-colors-border-default: var(--chakra-colors-gray-300);
        --chakra-colors-border-muted: var(--chakra-colors-gray-200);
        --chakra-colors-code-bg: var(--chakra-colors-gray-100);
        --chakra-colors-code-fg: var(--chakra-colors-blue-900);
        --chakra-colors-fg: var(--chakra-colors-gray-950);
        --chakra-colors-fg-muted: var(--chakra-colors-gray-600);
        --chakra-colors-link: var(--chakra-colors-blue-600);
        --chakra-colors-overlay-backdrop: var(--chakra-colors-black-alpha-600);
        --chakra-colors-overlay-shadow: var(--chakra-colors-black-alpha-300);
        --chakra-colors-selection-comment: var(--chakra-colors-yellow-600);
        --chakra-colors-syntax-addition-bg: var(--chakra-colors-green-100);
        --chakra-colors-syntax-addition-fg: var(--chakra-colors-green-800);
        --chakra-colors-syntax-attribute: var(--chakra-colors-green-800);
        --chakra-colors-syntax-comment: var(--chakra-colors-gray-600);
        --chakra-colors-syntax-deletion-bg: var(--chakra-colors-red-100);
        --chakra-colors-syntax-deletion-fg: var(--chakra-colors-red-800);
        --chakra-colors-syntax-keyword: var(--chakra-colors-red-800);
        --chakra-colors-syntax-literal: var(--chakra-colors-orange-800);
        --chakra-colors-syntax-meta: var(--chakra-colors-purple-800);
        --chakra-colors-syntax-string: var(--chakra-colors-green-800);
        --chakra-colors-syntax-type: var(--chakra-colors-blue-800);
        --chakra-colors-warning-fg: var(--chakra-colors-yellow-700);
      }

      @media (prefers-color-scheme: dark) {
        :root:not([data-theme="light"]) {
          --chakra-colors-accent: var(--chakra-colors-blue-400);
          --chakra-colors-canvas: var(--chakra-colors-gray-950);
          --chakra-colors-canvas-subtle: var(--chakra-colors-gray-900);
          --chakra-colors-border-default: var(--chakra-colors-gray-700);
          --chakra-colors-border-muted: var(--chakra-colors-gray-800);
          --chakra-colors-code-bg: var(--chakra-colors-gray-800);
          --chakra-colors-code-fg: var(--chakra-colors-blue-300);
          --chakra-colors-fg: var(--chakra-colors-gray-100);
          --chakra-colors-fg-muted: var(--chakra-colors-gray-400);
          --chakra-colors-link: var(--chakra-colors-blue-400);
          --chakra-colors-selection-comment: var(--chakra-colors-yellow-400);
          --chakra-colors-syntax-addition-bg: var(--chakra-colors-green-950);
          --chakra-colors-syntax-addition-fg: var(--chakra-colors-green-100);
          --chakra-colors-syntax-attribute: var(--chakra-colors-green-300);
          --chakra-colors-syntax-comment: var(--chakra-colors-gray-400);
          --chakra-colors-syntax-deletion-bg: var(--chakra-colors-red-950);
          --chakra-colors-syntax-deletion-fg: var(--chakra-colors-red-100);
          --chakra-colors-syntax-keyword: var(--chakra-colors-red-400);
          --chakra-colors-syntax-literal: var(--chakra-colors-orange-300);
          --chakra-colors-syntax-meta: var(--chakra-colors-blue-300);
          --chakra-colors-syntax-string: var(--chakra-colors-blue-200);
          --chakra-colors-syntax-type: var(--chakra-colors-purple-300);
          --chakra-colors-warning-fg: var(--chakra-colors-yellow-400);
        }
      }

      :root[data-theme="light"] {
        color-scheme: light;
      }

      :root[data-theme="dark"] {
        color-scheme: dark;
        --chakra-colors-accent: var(--chakra-colors-blue-400);
        --chakra-colors-canvas: var(--chakra-colors-gray-950);
        --chakra-colors-canvas-subtle: var(--chakra-colors-gray-900);
        --chakra-colors-border-default: var(--chakra-colors-gray-700);
        --chakra-colors-border-muted: var(--chakra-colors-gray-800);
        --chakra-colors-code-bg: var(--chakra-colors-gray-800);
        --chakra-colors-code-fg: var(--chakra-colors-blue-300);
        --chakra-colors-fg: var(--chakra-colors-gray-100);
        --chakra-colors-fg-muted: var(--chakra-colors-gray-400);
        --chakra-colors-link: var(--chakra-colors-blue-400);
        --chakra-colors-selection-comment: var(--chakra-colors-yellow-400);
        --chakra-colors-syntax-addition-bg: var(--chakra-colors-green-950);
        --chakra-colors-syntax-addition-fg: var(--chakra-colors-green-100);
        --chakra-colors-syntax-attribute: var(--chakra-colors-green-300);
        --chakra-colors-syntax-comment: var(--chakra-colors-gray-400);
        --chakra-colors-syntax-deletion-bg: var(--chakra-colors-red-950);
        --chakra-colors-syntax-deletion-fg: var(--chakra-colors-red-100);
        --chakra-colors-syntax-keyword: var(--chakra-colors-red-400);
        --chakra-colors-syntax-literal: var(--chakra-colors-orange-300);
        --chakra-colors-syntax-meta: var(--chakra-colors-blue-300);
        --chakra-colors-syntax-string: var(--chakra-colors-blue-200);
        --chakra-colors-syntax-type: var(--chakra-colors-purple-300);
        --chakra-colors-warning-fg: var(--chakra-colors-yellow-400);
      }

      .comment-markdown-list > .task-list-item {
        list-style-type: none;
      }

      .hljs {
        color: var(--chakra-colors-code-fg);
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


      .comment-markdown-body table {
        display: block;
        overflow: auto;
        width: max-content;
        max-width: 100%;
        border-spacing: 0;
        border-collapse: collapse;
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
        --comment-highlight-spacing-before: 0px;
        --comment-highlight-spacing-after: 0px;
      }

      .commentable-heading {
        --comment-highlight-spacing-before: var(--chakra-spacing-6);
        --comment-highlight-spacing-after: var(--chakra-spacing-4);
      }

      :where(
        .commentable-blockquote,
        .commentable-code-block,
        .commentable-paragraph
      ) {
        --comment-highlight-spacing-after: var(--chakra-spacing-4);
      }

      .commentable-horizontal-rule {
        --comment-highlight-spacing-before: var(--chakra-spacing-6);
        --comment-highlight-spacing-after: var(--chakra-spacing-6);
      }

      :where(.commentable-list-item, .commentable-table) {
        --comment-highlight-spacing-before: 0px;
        --comment-highlight-spacing-after: 0px;
      }

      .commentable-list-item {
        display: contents;
      }

      .commentable-list-item > .commentable-content {
        display: block;
      }

      .commentable-list-item > .commentable-content::before {
        left: calc(-1 * var(--chakra-spacing-2));
      }

      .comment-markdown-body {
        display: contents;
      }

      .commentable-content::before {
        content: "";
        position: absolute;
        z-index: -1;
        top: calc(-1 * var(--comment-highlight-spacing-before) + 1px);
        right: calc(-1 * var(--chakra-spacing-2));
        bottom: calc(-1 * var(--comment-highlight-spacing-after) + 1px);
        left: calc(-1 * var(--chakra-spacing-2) - var(--comment-indent-offset, 0em));
        border-radius: var(--chakra-radii-sm);
        background: var(--chakra-colors-transparent);
        pointer-events: none;
        transition: background-color 120ms ease;
      }

      .commentable-block:has(+ .commentable-heading)
        > .commentable-content::before {
        bottom: 1px;
      }

      .commentable-block:not(.commentable-block-selected):not(.commentable-block-continuous-highlight):has(.comment-thread) > .commentable-content::before {
        background: color-mix(in srgb, var(--chakra-colors-accent) 8%, var(--chakra-colors-canvas));
      }

      .commentable-block:not(.commentable-block-selected):hover > .commentable-content::before,
      .commentable-block:not(.commentable-block-selected):focus-within > .commentable-content::before {
        background: color-mix(in srgb, var(--chakra-colors-accent) 14%, var(--chakra-colors-canvas));
      }

      .commentable-block-comment-highlight > .commentable-content::before {
        background: color-mix(in srgb, var(--chakra-colors-selection-comment) 18%, var(--chakra-colors-canvas));
      }

      .commentable-block-range-selected > .commentable-content::before {
        background: color-mix(in srgb, var(--chakra-colors-accent) 18%, var(--chakra-colors-canvas));
      }

      .comment-thread {
        margin: calc(-1 * var(--chakra-spacing-2)) 0 var(--chakra-spacing-3);
        margin-left: calc(0em - var(--comment-indent-offset, 0em));
        border-left: 3px solid var(--chakra-colors-accent);
        padding: var(--chakra-spacing-2) 0 1px var(--chakra-spacing-3);
      }

      .commentable-list-item > .comment-thread {
        margin-top: var(--chakra-spacing-2);
      }

      .mermaid-container {
        position: relative;
        margin-bottom: var(--chakra-spacing-4);
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

      .mermaid-zoom-button {
        position: absolute;
        top: var(--chakra-spacing-2);
        right: var(--chakra-spacing-2);
        background: var(--chakra-colors-canvas);
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
