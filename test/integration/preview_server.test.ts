import { assertEquals } from "@std/assert";

import { createPreviewHandler } from "../../src/server/mod.ts";

Deno.test("serves hot reload events as an SSE stream", async () => {
  const filePath = "test/integration/fixtures/comprehensive.md";
  const response = await createPreviewHandler(filePath)(
    new Request("http://127.0.0.1:3334/__sadoku/events"),
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
  const response = await createPreviewHandler(
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

Deno.test("notifies when an interrupted event stream closes", async () => {
  const requestController = new AbortController();
  let opened = 0;
  let closed = 0;
  const response = await createPreviewHandler(
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

Deno.test("keeps remote event streams empty and reports cancellation", async () => {
  let opened = 0;
  let closed = 0;
  const response = await createPreviewHandler("https://example.com/readme.md", {
    onEventStreamOpen: () => opened += 1,
    onEventStreamClose: () => closed += 1,
  })(
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

Deno.test("serves the preview client asset", async () => {
  const filePath = "test/integration/fixtures/comprehensive.md";
  const response = await createPreviewHandler(filePath)(
    new Request("http://127.0.0.1:3334/assets/client.js"),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/javascript; charset=utf-8",
  );
  assertEquals(response.headers.get("cache-control"), "no-store");
  const script = await response.text();
  assertEquals(script.includes("/__sadoku/documents/"), true);
  assertEquals(script.includes('"/__sadoku/comments"'), false);
  assertEquals(script.includes('"/__sadoku/document"'), false);
  assertEquals(script.includes('"/__sadoku/events"'), false);
  assertEquals(script.includes("process.env"), false);
});

Deno.test("serves the SPA shell", async () => {
  const filePath = "test/integration/fixtures/comprehensive.md";
  const response = await createPreviewHandler(filePath)(
    new Request("http://127.0.0.1:3334/"),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  const html = await response.text();

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
  assertEquals(html.includes('<div id="sadoku-client-root"></div>'), true);
  assertEquals(html.includes('src="/assets/client.js"'), true);
});

Deno.test("serves the raw preview document for the SPA", async () => {
  const filePath = "test/integration/fixtures/comprehensive.md";
  const response = await createPreviewHandler(filePath)(
    new Request("http://127.0.0.1:3334/__sadoku/document"),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  const document = await response.json();

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(document.title, "comprehensive.md");
  assertEquals(document.fileUrl.endsWith("/comprehensive.md"), true);
  assertEquals(document.markdown.includes("# Comprehensive Document"), true);
});
