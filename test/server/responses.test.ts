import { assertEquals } from "@std/assert";

import {
  methodNotAllowedResponse,
  noStoreJson,
  notFoundResponse,
  textResponse,
} from "../../src/server/responses.ts";

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
