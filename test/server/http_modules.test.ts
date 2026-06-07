import { assertEquals, assertStringIncludes } from "@std/assert";

import { handlePreviewAssetRequest } from "../../src/server/assets.ts";
import { handlePreviewDocumentRequest } from "../../src/server/document.ts";
import {
  methodNotAllowedResponse,
  noStoreJson,
  notFoundResponse,
  textResponse,
} from "../../src/server/responses.ts";
import { renderSpaShell } from "../../src/server/shell.ts";
import { createTempMarkdown, removeTempMarkdown } from "./test_helpers.ts";

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
    "/assets/mermaid.esm.min.mjs",
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

Deno.test("returns the current Markdown document without caching", async () => {
  const filePath = await createTempMarkdown("first");
  try {
    const first = await handlePreviewDocumentRequest(filePath);
    await Deno.writeTextFile(filePath, "second");
    const second = await handlePreviewDocumentRequest(filePath);

    assertEquals(first.headers.get("cache-control"), "no-store");
    assertEquals((await first.json()).markdown, "first");
    assertEquals((await second.json()).markdown, "second");
  } finally {
    await removeTempMarkdown(filePath);
  }
});

Deno.test("escapes all HTML-sensitive characters in the SPA title", () => {
  const html = renderSpaShell(`<&>"' title`);

  assertStringIncludes(
    html,
    "<title>&lt;&amp;&gt;&quot;&#39; title</title>",
  );
  assertEquals(html.includes(`<title><&>"' title</title>`), false);
});

Deno.test("builds consistent shared responses", async () => {
  const text = textResponse("bad", 400);
  assertEquals(text.status, 400);
  assertEquals(text.headers.get("content-type"), "text/plain; charset=utf-8");
  assertEquals(await text.text(), "bad");

  const notFound = notFoundResponse();
  assertEquals(notFound.status, 404);
  assertEquals(await notFound.text(), "Not found.");

  const methodNotAllowed = methodNotAllowedResponse();
  assertEquals(methodNotAllowed.status, 405);
  assertEquals(await methodNotAllowed.text(), "Method not allowed.");

  const json = noStoreJson({ ok: true });
  assertEquals(json.status, 200);
  assertEquals(json.headers.get("cache-control"), "no-store");
  assertEquals(await json.json(), { ok: true });
});
