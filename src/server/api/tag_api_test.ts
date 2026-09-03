import { assertEquals } from "@std/assert";
import type { TagStore } from "../usecase/tag/ports.ts";
import { patchTag } from "./tag_api.ts";

const store: TagStore = {
  list: () => Promise.resolve([]),
  listForDocument: () => Promise.resolve([]),
  rename: (_id, _name) =>
    Promise.resolve({
      type: "conflict",
      message: "Tag name already exists.",
    }),
  replaceForDocument: () => Promise.resolve([]),
};

Deno.test("tag API maps rename conflicts to HTTP 409", async () => {
  const response = await patchTag(
    new Request("http://localhost/__sadoku/tags/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "API" }),
    }),
    1,
    store,
  );
  assertEquals(response.status, 409);
  assertEquals(await response.text(), "Tag name already exists.");
});

Deno.test("tag API rejects invalid rename JSON", async () => {
  const response = await patchTag(
    new Request("http://localhost/__sadoku/tags/1", {
      method: "PATCH",
      body: "{",
    }),
    1,
    store,
  );
  assertEquals(response.status, 400);
});
