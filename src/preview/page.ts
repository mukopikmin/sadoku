export type PreviewPageOptions = {
  title: string;
  body: string;
  fileUrl: string;
};

export const renderPreviewPage = (
  { title, body, fileUrl }: PreviewPageOptions,
): string =>
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.6;
      }

      body {
        margin: 0;
        background: Canvas;
        color: CanvasText;
      }

      main {
        box-sizing: border-box;
        width: min(100%, 920px);
        margin: 0 auto;
        padding: 40px 24px 64px;
      }

      header {
        margin-bottom: 32px;
        padding-bottom: 16px;
        border-bottom: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
        color: color-mix(in srgb, CanvasText 70%, transparent);
        font-size: 0.9rem;
      }

      h1, h2, h3, h4, h5, h6 {
        line-height: 1.25;
        margin: 1.5em 0 0.5em;
      }

      h1:first-child, h2:first-child, h3:first-child {
        margin-top: 0;
      }

      a {
        color: LinkText;
      }

      .heading-anchor {
        color: inherit;
        text-decoration: none;
      }

      .heading-anchor:hover {
        text-decoration: underline;
      }

      img {
        max-width: 100%;
        height: auto;
      }

      code {
        border-radius: 4px;
        padding: 0.12em 0.3em;
        background: color-mix(in srgb, CanvasText 10%, transparent);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 0.92em;
      }

      pre {
        overflow: auto;
        border-radius: 8px;
        padding: 16px;
        background: color-mix(in srgb, CanvasText 10%, transparent);
      }

      pre code {
        padding: 0;
        background: transparent;
      }

      blockquote {
        margin: 1em 0;
        padding-left: 1em;
        border-left: 4px solid color-mix(in srgb, CanvasText 25%, transparent);
        color: color-mix(in srgb, CanvasText 78%, transparent);
      }

      table {
        border-collapse: collapse;
        width: 100%;
      }

      th, td {
        border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
        padding: 6px 10px;
      }

      .mermaid {
        overflow: auto;
        border-radius: 8px;
        padding: 16px;
        background: color-mix(in srgb, CanvasText 6%, transparent);
      }
    </style>
  </head>
  <body>
    <main>
      <header>Previewing <a href="${fileUrl}">${title}</a>. Refresh to reload changes.</header>
      ${body}
    </main>
    ${renderMermaidScript(body)}
  </body>
</html>`;

const renderMermaidScript = (body: string): string => {
  if (!body.includes('class="mermaid"')) return "";

  return `<script type="module">
      import mermaid from "/assets/mermaid.esm.min.mjs";

      mermaid.initialize({
        startOnLoad: true,
        theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default"
      });
    </script>`;
};
