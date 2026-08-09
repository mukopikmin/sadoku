import { assertEquals, assertMatch } from "@std/assert";

import { getCommentsFilePath } from "./comments/storage.ts";
import { createPreviewHandler } from "./handler.ts";
import {
  createTempMarkdown,
  removeTempMarkdown,
  serveHandlerInfo,
  withTempCommentsDirectory,
} from "./test_helpers.ts";

const requestHandler = async (
  handler: Deno.ServeHandler,
  pathname: string,
  init?: RequestInit,
): Promise<Response> =>
  await handler(
    new Request(`http://127.0.0.1:3334${pathname}`, init),
    serveHandlerInfo,
  );

Deno.test("keeps API, asset, and SPA routes separate", async () => {
  const filePath = await createTempMarkdown("# Explicit routes\n");
  const handler = createPreviewHandler(filePath);
  try {
    const document = await requestHandler(handler, "/__sadoku/document");
    assertEquals(document.status, 200);
    assertEquals(document.headers.get("content-type"), "application/json");
    assertEquals(document.headers.get("cache-control"), "no-store");
    assertEquals((await document.json()).markdown, "# Explicit routes\n");

    const unsupportedDocument = await requestHandler(
      handler,
      "/__sadoku/document",
      { method: "POST" },
    );
    assertEquals(unsupportedDocument.status, 404);
    assertEquals(await unsupportedDocument.text(), "Not found.");

    const unsupportedComment = await requestHandler(
      handler,
      "/__sadoku/comments/1",
      { method: "PATCH" },
    );
    assertEquals(unsupportedComment.status, 405);
    assertEquals(unsupportedComment.headers.get("allow"), null);
    assertEquals(await unsupportedComment.text(), "Method not allowed.");

    const asset = await requestHandler(handler, "/assets/client.js");
    assertEquals(asset.status, 200);
    assertEquals(
      asset.headers.get("content-type"),
      "text/javascript; charset=utf-8",
    );
    assertEquals(asset.headers.get("cache-control"), "no-store");

    const missingAsset = await requestHandler(handler, "/assets/missing.js");
    assertEquals(missingAsset.status, 404);
    assertEquals(await missingAsset.text(), "Asset not found.");

    const page = await requestHandler(handler, "/some/unknown/page");
    assertEquals(page.status, 200);
    assertEquals(page.headers.get("content-type"), "text/html; charset=utf-8");
    assertMatch(await page.text(), /<!doctype html>/i);

    const unknownApi = await requestHandler(handler, "/__sadoku/unknown");
    assertEquals(unknownApi.status, 404);
    assertEquals(
      unknownApi.headers.get("content-type"),
      "text/plain; charset=utf-8",
    );
    assertEquals(await unknownApi.text(), "Not found.");
  } finally {
    await removeTempMarkdown(filePath);
  }
});

Deno.test("converts handler failures to plain text server errors", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    await Deno.writeTextFile(getCommentsFilePath(filePath), "{");
    try {
      const response = await requestHandler(
        createPreviewHandler(filePath),
        "/__sadoku/comments",
      );

      assertEquals(response.status, 500);
      assertEquals(
        response.headers.get("content-type"),
        "text/plain; charset=utf-8",
      );
      assertMatch(await response.text(), /^Failed to render Markdown:/);
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("returns a server error when the Markdown document disappears", async () => {
  const filePath = await createTempMarkdown();
  const handler = createPreviewHandler(filePath);
  await Deno.remove(filePath);
  try {
    const response = await requestHandler(handler, "/__sadoku/document");

    assertEquals(response.status, 500);
    assertMatch(await response.text(), /^Failed to render Markdown:/);
  } finally {
    await removeTempMarkdown(filePath);
  }
});
