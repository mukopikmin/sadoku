import { previewAssetPaths, previewStylesheetPaths } from "./asset_manifest.ts";
import { parsePublicBasePath } from "./base_path.ts";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const renderSpaShell = (title: string, basePath = ""): string => {
  if (parsePublicBasePath(basePath) === undefined) {
    throw new Error("Invalid public base path.");
  }
  return `<!doctype html>
<html lang="und">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="${basePath}${previewAssetPaths.favicon}" sizes="any">
    <link rel="apple-touch-icon" href="${basePath}${previewAssetPaths.icon}">
    ${
    previewStylesheetPaths.map((path) =>
      `<link rel="stylesheet" href="${basePath}${path}">`
    ).join("\n    ")
  }
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="sadoku-client-root" data-base-path="${basePath}"></div>
    <script type="module" src="${basePath}${previewAssetPaths.client}"></script>
  </body>
</html>`;
};
