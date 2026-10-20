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

Deno.test("serves all bundled font subsets through prefixed stylesheet URLs", async () => {
  assertEquals(previewStylesheetPaths.length > 0, true);
  const fontPaths = new Set<string>();
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
    const css = await response.text();
    for (const [, url] of css.matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)) {
      const resolved = new URL(url, `http://localhost/revisions/pr-42${path}`);
      assertEquals(resolved.origin, "http://localhost");
      assertEquals(
        resolved.pathname.startsWith("/revisions/pr-42/assets/"),
        true,
      );
      fontPaths.add(resolved.pathname.slice("/revisions/pr-42".length));
    }
  }
  assertEquals(fontPaths.size > 0, true);
  for (const path of fontPaths) {
    const response = await handlePreviewAssetRequest(path);
    assertEquals(response.status, 200, path);
    assertEquals(response.headers.get("content-type"), "font/woff2");
    assertEquals(
      response.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    assertEquals(new TextDecoder().decode(bytes.slice(0, 4)), "wOF2");
  }
});

Deno.test("serves the upstream font copyright and distributor license", async () => {
  const upstream = await handlePreviewAssetRequest(
    "/assets/fonts/noto-sans-jp/OFL.txt",
  );
  assertEquals(upstream.status, 200);
  assertEquals(
    upstream.headers.get("content-type"),
    "text/plain; charset=utf-8",
  );
  const text = await upstream.text();
  assertStringIncludes(text, "Copyright 2014-2021 Adobe");
  assertStringIncludes(text, "Reserved Font Name 'Source'");
  assertStringIncludes(text, "SIL OPEN FONT LICENSE Version 1.1");
  assertStringIncludes(text, "DISCLAIMER");

  const distributor = await handlePreviewAssetRequest(
    "/assets/fonts/noto-sans-jp/FONTSOURCE-LICENSE.txt",
  );
  assertEquals(distributor.status, 200);
  assertEquals(
    await distributor.text(),
    await Deno.readTextFile(
      "src/preview/node_modules/@fontsource-variable/noto-sans-jp/LICENSE",
    ),
  );
});
