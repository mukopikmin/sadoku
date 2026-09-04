import { assertEquals, assertStringIncludes } from "@std/assert";

import { renderSpaShell } from "./shell.ts";
import { previewAssetPaths } from "./asset_manifest.ts";
import { readPreviewAsset } from "./assets.ts";

Deno.test("escapes all HTML-sensitive characters in the SPA title", () => {
  const html = renderSpaShell(`<&>"' title`);

  assertStringIncludes(
    html,
    "<title>&lt;&amp;&gt;&quot;&#39; title</title>",
  );
  assertEquals(html.includes(`<title><&>"' title</title>`), false);
});

Deno.test("links existing preview assets in the SPA head", async () => {
  const html = renderSpaShell("Preview");

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
  for (const path of Object.values(previewAssetPaths)) {
    const asset = await readPreviewAsset(path);
    assertEquals(asset !== undefined && asset.byteLength > 0, true);
  }
});
