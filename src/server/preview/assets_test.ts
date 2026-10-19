import { assertEquals, assertStringIncludes } from "@std/assert";

import { handlePreviewAssetRequest } from "./assets.ts";
import {
  previewAssetManifest,
  previewAssetPaths,
  previewStylesheetPaths,
} from "./asset_manifest.ts";

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
  assertEquals(favicon.headers.get("cache-control"), "no-store");

  const icon = await handlePreviewAssetRequest(previewAssetPaths.icon);
  assertEquals(icon.status, 200);
  assertEquals(icon.headers.get("content-type"), "image/png");
  assertEquals(icon.headers.get("cache-control"), "no-store");
});

Deno.test("serves bundled font stylesheets, fonts, and their licenses", async () => {
  assertEquals(previewStylesheetPaths.length > 0, true);
  for (const path of previewStylesheetPaths) {
    const response = await handlePreviewAssetRequest(path);
    assertEquals(response.status, 200);
    assertEquals(
      response.headers.get("content-type"),
      "text/css; charset=utf-8",
    );
    assertEquals(
      response.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
    );
    // Resolve the built CSS URLs as a browser would, including a public prefix.
    const css = await response.text();
    const fontUrls = [...css.matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)];
    assertEquals(fontUrls.length, 4);
    for (const [, url] of fontUrls) {
      const fontPath = new URL(url, `http://localhost/revisions/pr-42${path}`)
        .pathname;
      assertEquals(fontPath.startsWith("/revisions/pr-42/assets/fonts/"), true);
      const font = await handlePreviewAssetRequest(
        fontPath.slice("/revisions/pr-42".length),
      );
      assertEquals(font.status, 200);
      assertEquals(font.headers.get("content-type"), "font/woff2");
      const bytes = new Uint8Array(await font.arrayBuffer());
      assertEquals(new TextDecoder().decode(bytes.slice(0, 4)), "wOF2");
    }
  }
  for (
    const [path, author] of [
      ["gitlab-sans/LICENSE.txt", "The Inter Project Authors"],
      ["gitlab-mono/OFL.txt", "The JetBrains Mono Project Authors"],
    ]
  ) {
    const response = await handlePreviewAssetRequest(`/assets/fonts/${path}`);
    assertEquals(response.status, 200);
    assertEquals(
      response.headers.get("content-type"),
      "text/plain; charset=utf-8",
    );
    const license = await response.text();
    assertStringIncludes(license, author);
    assertStringIncludes(license, "Portions Copyright 2022 Gitlab B.V.");
    assertStringIncludes(license, "SIL OPEN FONT LICENSE Version 1.1");
    assertStringIncludes(license, "PERMISSION");
    assertStringIncludes(license, "DISCLAIMER");
  }
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
