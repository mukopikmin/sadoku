import { assertEquals } from "@std/assert";

import { handlePreviewAssetRequest } from "./assets.ts";
import { previewAssetManifest, previewAssetPaths } from "./asset_manifest.ts";

Deno.test("rejects missing and traversing asset paths", async () => {
  for (
    const pathname of [
      "/assets/",
      "/assets/missing.js",
      "/assets/../server/server.ts",
      "/assets/%2e%2e/server/server.ts",
      "/assets//etc/passwd",
    ]
  ) {
    const response = await handlePreviewAssetRequest(pathname);
    assertEquals(response.status, 404);
    assertEquals(await response.text(), "Asset not found.");
  }
});

Deno.test("serves fingerprintable assets with immutable caching", async () => {
  const response = await handlePreviewAssetRequest(
    `/assets/${
      previewAssetManifest["node_modules/mermaid/dist/mermaid.core.mjs"].file
    }`,
  );

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );
  assertEquals(
    response.headers.get("content-type"),
    "text/javascript; charset=utf-8",
  );
  assertEquals((await response.arrayBuffer()).byteLength > 0, true);
});

Deno.test("serves preview icons with image content types", async () => {
  const favicon = await handlePreviewAssetRequest(previewAssetPaths.favicon);
  assertEquals(favicon.status, 200);
  assertEquals(favicon.headers.get("content-type"), "image/x-icon");

  const icon = await handlePreviewAssetRequest(previewAssetPaths.icon);
  assertEquals(icon.status, 200);
  assertEquals(icon.headers.get("content-type"), "image/png");
});

Deno.test("does not cache fixed-name mutable assets as immutable", async () => {
  const manifest = await handlePreviewAssetRequest(
    "/assets/.vite/manifest.json",
  );
  assertEquals(manifest.status, 200);
  assertEquals(manifest.headers.get("cache-control"), "no-store");
  assertEquals(
    manifest.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
});
