export const previewThemeCss = `
      body {
        margin: 0;
      }

      .radix-themes {
        min-height: 100vh;
        font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", "Noto Sans CJK JP", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        line-height: 1.65;
      }

      main {
        box-sizing: border-box;
        width: min(100%, 980px);
        margin: 0 auto;
        padding: var(--space-6) var(--space-6) var(--space-9);
      }

      header.sticky-preview-header {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        margin-bottom: var(--space-6);
        border-bottom: 1px solid var(--gray-6);
        padding-bottom: var(--space-4);
        background: var(--color-background);
        color: var(--gray-11);
        font-size: var(--font-size-2);
      }

      header.sticky-preview-header a {
        color: var(--gray-12);
        font-weight: 600;
      }

      .reload-notice {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin-left: var(--space-2);
        color: var(--amber-11);
      }

      .heading-anchor {
        color: inherit;
        text-decoration: none;
      }

      img {
        max-width: 100%;
        height: auto;
      }

      ul,
      ol {
        padding-left: 2em;
      }

      li + li {
        margin-top: var(--space-1);
      }

      li > ul,
      li > ol {
        margin-top: var(--space-1);
        margin-bottom: 0;
      }

      .task-list-item {
        list-style-type: none;
      }

      .task-list-item-checkbox {
        margin: 0 0.5em 0.2em -1.5em;
        vertical-align: middle;
      }

      pre {
        overflow: auto;
        margin-top: 0;
        margin-bottom: var(--space-4);
        border: 1px solid var(--gray-6);
        border-radius: var(--radius-3);
        padding: var(--space-4);
        background: var(--gray-2);
        line-height: 1.45;
      }

      pre code {
        padding: 0;
        background: transparent;
        font-size: var(--font-size-2);
      }

      .hljs {
        color: var(--gray-12);
      }

      .hljs-comment,
      .hljs-quote {
        color: var(--gray-11);
      }

      .hljs-keyword,
      .hljs-selector-tag,
      .hljs-subst {
        color: var(--tomato-11);
      }

      .hljs-literal,
      .hljs-number,
      .hljs-tag .hljs-attr,
      .hljs-template-variable,
      .hljs-variable {
        color: var(--amber-11);
      }

      .hljs-doctag,
      .hljs-string,
      .hljs-title,
      .hljs-section,
      .hljs-selector-id {
        color: var(--blue-11);
      }

      .hljs-type,
      .hljs-class .hljs-title,
      .hljs-built_in,
      .hljs-builtin-name {
        color: var(--violet-11);
      }

      .hljs-attr,
      .hljs-attribute,
      .hljs-name,
      .hljs-selector-class,
      .hljs-selector-attr,
      .hljs-selector-pseudo {
        color: var(--green-11);
      }

      .hljs-symbol,
      .hljs-bullet,
      .hljs-link,
      .hljs-meta {
        color: var(--cyan-11);
      }

      .hljs-deletion {
        color: var(--red-11);
        background: var(--red-a3);
      }

      .hljs-addition {
        color: var(--green-11);
        background: var(--green-a3);
      }

      .commentable-block {
        position: relative;
        margin-left: calc(-1 * var(--space-8));
        padding-left: var(--space-8);
      }

      .commentable-content {
        cursor: pointer;
        isolation: isolate;
        position: relative;
      }

      .comment-markdown-body {
        position: relative;
        z-index: 1;
        display: block;
      }

      .commentable-content::before {
        content: "";
        position: absolute;
        z-index: 0;
        inset: calc(-1 * var(--space-1)) calc(-1 * var(--space-2));
        border-radius: var(--radius-3);
        background: transparent;
        pointer-events: none;
        transition: background-color 120ms ease;
      }

      .commentable-block:has(.comment-thread) > .commentable-content::before {
        background: var(--accent-a3);
      }

      .commentable-block-selected > .commentable-content::before {
        background: color-mix(in srgb, var(--color-accent) 16%, transparent);
      }

      .commentable-block:hover > .commentable-content::before,
      .commentable-block:focus-within > .commentable-content::before {
        background: var(--accent-a4);
      }

      .comment-selection-button {
        position: absolute;
        z-index: 1;
        top: 0;
        right: 0;
        border: 1px solid var(--accent-8);
        border-radius: var(--radius-2);
        background: var(--accent-9);
        color: #ffffff;
        cursor: pointer;
        font: inherit;
        font-size: var(--font-size-1);
        font-weight: var(--font-weight-bold);
        padding: var(--space-1) var(--space-2);
      }

      .comment-thread {
        margin: calc(-1 * var(--space-2)) 0 var(--space-3);
        border-left: 3px solid var(--accent-8);
        padding: var(--space-2) 0 1px var(--space-3);
      }

      .commentable-list-item > .comment-thread {
        margin: 6px 0 12px;
      }

      .comment-item-header,
      .comment-reply-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        margin-bottom: var(--space-2);
      }

      .comment-thread-heading {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--gray-11);
        font-size: var(--font-size-1);
        font-weight: var(--font-weight-bold);
      }

      .comment-list,
      .comment-list-items {
        display: grid;
      }

      .comment-list {
        gap: var(--space-6);
      }

      .comment-list-items {
        gap: var(--space-3);
      }

      .comment-form,
      .comment-item {
        margin-bottom: var(--space-2);
      }

      .comment-source-block {
        margin-bottom: var(--space-2);
      }

      .comment-source-label,
      .comment-reply-label {
        margin-bottom: var(--space-1);
        color: var(--gray-11);
      }

      .comment-source {
        margin-bottom: var(--space-2);
        padding: var(--space-2) var(--space-3);
        color: var(--gray-11);
      }

      .comment-body {
        white-space: pre-wrap;
      }

      .comment-input {
        width: 100%;
        min-height: 56px;
      }

      .comment-list .comment-input {
        min-height: 84px;
      }

      .comment-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin-top: var(--space-1);
      }

      .comment-item-header > .comment-actions,
      .comment-reply-header .comment-actions {
        margin-top: 0;
      }

      .comment-replies {
        display: grid;
        gap: var(--space-2);
        margin: var(--space-2) 0 0 var(--space-4);
        border-left: 2px solid var(--gray-6);
        padding-left: var(--space-3);
      }

      .comment-reply-form {
        margin-top: var(--space-2);
      }

      .mermaid-container {
        position: relative;
        margin-bottom: var(--space-4);
      }

      .mermaid-container .mermaid {
        margin-bottom: 0;
      }

      .mermaid {
        overflow: auto;
        border: 1px solid var(--gray-6);
        border-radius: var(--radius-3);
        padding: var(--space-4);
        background: var(--gray-2);
      }

      .mermaid-zoom-button {
        position: absolute;
        top: var(--space-2);
        right: var(--space-2);
      }

      .mermaid-zoom-dialog {
        position: fixed;
        z-index: 1000;
        inset: 0;
        display: grid;
        place-items: center;
        padding: var(--space-5);
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
        border: 1px solid var(--gray-6);
        border-radius: var(--radius-4);
        padding: 44px var(--space-4) var(--space-4);
        background: var(--color-panel-solid);
        box-shadow: var(--shadow-6);
      }

      .mermaid-zoom-close {
        position: absolute;
        top: var(--space-2);
        right: var(--space-2);
        border: 1px solid var(--gray-7);
        border-radius: var(--radius-2);
        background: var(--color-panel-solid);
        color: var(--gray-12);
        cursor: pointer;
        font: inherit;
        font-size: var(--font-size-4);
        line-height: 1;
      }

      .mermaid-zoom-close:hover,
      .mermaid-zoom-close:focus-visible {
        border-color: var(--accent-8);
        color: var(--accent-11);
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

      @media (max-width: 640px) {
        main {
          padding: var(--space-5) var(--space-4) var(--space-8);
        }

        header {
          align-items: stretch;
          flex-direction: column;
        }

        .commentable-block {
          margin-left: 0;
          padding-left: 0;
        }

        .comment-selection-button {
          position: static;
          margin: 0 0 var(--space-2);
        }

        .comment-item-header {
          align-items: flex-start;
          flex-direction: column;
        }
      }
`;
