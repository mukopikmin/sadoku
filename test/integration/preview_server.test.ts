import { assertEquals } from "@std/assert";

import { createTestPreviewHandler } from "../../src/server/test_helpers.ts";
import {
  previewAssetManifest,
  previewAssetPaths,
} from "../../src/server/preview/asset_manifest.ts";

Deno.test("serves hot reload events as an SSE stream", async () => {
  const filePath = "test/integration/fixtures/comprehensive.md";
  const response = await createTestPreviewHandler(filePath)(
    new Request("http://127.0.0.1:3334/__sadoku/documents/1/events"),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/event-stream; charset=utf-8",
  );
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(response.headers.get("connection"), "keep-alive");

  await response.body?.cancel();
});

Deno.test("rejects unsupported methods for the event stream route", async () => {
  const response = await createTestPreviewHandler(
    "test/integration/fixtures/comprehensive.md",
  )(
    new Request("http://127.0.0.1:3334/__sadoku/events", {
      method: "POST",
    }),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  assertEquals(response.status, 404);
  assertEquals(await response.text(), "Not found.");
});

Deno.test("notifies when an interrupted session event stream closes", async () => {
  const requestController = new AbortController();
  let opened = 0;
  let closed = 0;
  const response = await createTestPreviewHandler(
    "test/integration/fixtures/comprehensive.md",
    {
      onEventStreamOpen: () => opened += 1,
      onEventStreamClose: () => closed += 1,
    },
  )(
    new Request("http://127.0.0.1:3334/__sadoku/events", {
      signal: requestController.signal,
    }),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  assertEquals(opened, 1);
  requestController.abort();
  await response.body?.pipeTo(new WritableStream());
  assertEquals(closed, 1);
});

Deno.test("keeps the session event stream empty and reports cancellation", async () => {
  let opened = 0;
  let closed = 0;
  const response = await createTestPreviewHandler(
    "https://example.com/readme.md",
    {
      onEventStreamOpen: () => opened += 1,
      onEventStreamClose: () => closed += 1,
    },
  )(
    new Request("http://127.0.0.1:3334/__sadoku/events"),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  assertEquals(
    response.headers.get("content-type"),
    "text/event-stream; charset=utf-8",
  );
  assertEquals(opened, 1);
  await response.body?.cancel();
  assertEquals(closed, 1);
});

Deno.test("serves the fingerprinted preview client asset", async () => {
  const filePath = "test/integration/fixtures/comprehensive.md";
  const response = await createTestPreviewHandler(filePath)(
    new Request(`http://127.0.0.1:3334${previewAssetPaths.client}`),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/javascript; charset=utf-8",
  );
  assertEquals(
    response.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );
  const script = await response.text();
  assertEquals(script.includes("/__sadoku/documents/"), true);
  assertEquals(script.includes('"/__sadoku/comments"'), false);
  assertEquals(script.includes('"/__sadoku/document"'), false);
  assertEquals(script.includes("/__sadoku/events"), true);
  assertEquals(script.includes("process.env"), false);
});

Deno.test("serves the SPA shell without caching at every client route", async () => {
  const filePath = "test/integration/fixtures/comprehensive.md";
  const handler = createTestPreviewHandler(filePath);
  for (const path of ["/", "/documents/1/comments"]) {
    const response = await handler(
      new Request(`http://127.0.0.1:3334${path}`),
      {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
    );
    const html = await response.text();

    assertEquals(response.status, 200);
    assertEquals(
      response.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    assertEquals(response.headers.get("cache-control"), "no-store");
    assertEquals(html.includes('<div id="sadoku-client-root"></div>'), true);
    assertEquals(html.includes(`src="${previewAssetPaths.client}"`), true);
    for (const assetPath of Object.values(previewAssetPaths)) {
      assertEquals(html.includes(assetPath), true);
    }
  }
});

Deno.test("serves every generated Mermaid module dependency offline", async () => {
  const handler = createTestPreviewHandler(
    "test/integration/fixtures/comprehensive.md",
  );
  const pending = ["node_modules/mermaid/dist/mermaid.core.mjs"];
  const dependencyKeys = new Set<string>();
  while (pending.length > 0) {
    const key = pending.pop()!;
    if (dependencyKeys.has(key)) continue;
    dependencyKeys.add(key);
    const entry = previewAssetManifest[key];
    if (entry) {
      pending.push(...entry.imports ?? [], ...entry.dynamicImports ?? []);
    }
  }
  assertEquals(dependencyKeys.size > 1, true);

  for (const key of dependencyKeys) {
    const entry = previewAssetManifest[key];
    assertEquals(entry !== undefined, true, key);
    const response = await handler(
      new Request(`http://127.0.0.1:3334/assets/${entry.file}`),
      {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
    );
    assertEquals(response.status, 200, entry.file);
    assertEquals(
      response.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
    );
  }
});

Deno.test("serves the raw preview document for the SPA", async () => {
  const filePath = "test/integration/fixtures/comprehensive.md";
  const response = await createTestPreviewHandler(filePath)(
    new Request("http://127.0.0.1:3334/__sadoku/documents/1"),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  const document = await response.json();

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(document.title, "comprehensive.md");
  assertEquals(document.fileUrl.endsWith("/comprehensive.md"), true);
  assertEquals(document.markdown.includes("# Comprehensive Document"), true);
});
