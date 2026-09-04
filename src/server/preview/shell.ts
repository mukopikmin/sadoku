import { previewAssetPaths } from "./asset_manifest.ts";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const renderSpaShell = (title: string): string =>
  `<!doctype html>
<html lang="und">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="${previewAssetPaths.favicon}" sizes="any">
    <link rel="apple-touch-icon" href="${previewAssetPaths.icon}">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="sadoku-client-root"></div>
    <script type="module" src="${previewAssetPaths.client}"></script>
  </body>
</html>`;
