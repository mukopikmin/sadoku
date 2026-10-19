import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";

import { renderSpaShell } from "./shell.ts";
import { previewAssetPaths, previewStylesheetPaths } from "./asset_manifest.ts";
import { readPreviewAsset } from "./assets.ts";

Deno.test("escapes all HTML-sensitive characters in the SPA title", () => {
  const html = renderSpaShell(`<&>"' title`);

  assertStringIncludes(
    html,
    "<title>&lt;&amp;&gt;&quot;&#39; title</title>",
  );
  assertEquals(html.includes(`<title><&>"' title</title>`), false);
});

Deno.test("renders the public prefix for assets and browser configuration", () => {
  const html = renderSpaShell("Preview", "/revisions/pr-42");
  assertStringIncludes(html, 'data-base-path="/revisions/pr-42"');
  for (
    const path of [
      ...Object.values(previewAssetPaths),
      ...previewStylesheetPaths,
    ]
  ) {
    assertStringIncludes(html, `"/revisions/pr-42${path}"`);
  }
  assertThrows(() => renderSpaShell("Preview", "//evil.test"));
});

Deno.test("links existing preview assets in the SPA head", async () => {
  const html = renderSpaShell("Preview");

  assertEquals(previewStylesheetPaths.length > 0, true);
  for (const path of previewStylesheetPaths) {
    assertStringIncludes(html, `<link rel="stylesheet" href="${path}">`);
  }

  assertStringIncludes(
    html,
    `<link rel="icon" href="${previewAssetPaths.favicon}" sizes="any">`,
  );
  assertStringIncludes(
    html,
    `<link rel="apple-touch-icon" href="${previewAssetPaths.icon}">`,
  );
  assertStringIncludes(
    html,
    `<script type="module" src="${previewAssetPaths.client}"></script>`,
  );
  assertEquals(previewAssetPaths.favicon, "/assets/favicon.ico");
  assertEquals(previewAssetPaths.icon, "/assets/icon-512.png");
  assertEquals(
    /^\/assets\/.+-[\w-]{8}\.js$/.test(previewAssetPaths.client),
    true,
  );
  for (
    const path of [
      ...Object.values(previewAssetPaths),
      ...previewStylesheetPaths,
    ]
  ) {
    const asset = await readPreviewAsset(path);
    assertEquals(asset !== undefined && asset.byteLength > 0, true);
  }
});
