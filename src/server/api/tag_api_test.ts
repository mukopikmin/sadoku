import { assertEquals } from "@std/assert";
import type { TagStore } from "../usecase/tag/ports.ts";
import { patchTag } from "./tag_api.ts";

const store: TagStore = {
  list: () => Promise.resolve([]),
  listForDocument: () => Promise.resolve([]),
  rename: (_id, _name) =>
    Promise.resolve({ type: "not_found", message: "unused" }),
  update: (_id, _name, _backgroundColor) =>
    Promise.resolve({
      type: "conflict",
      message: "Tag name already exists.",
    }),
  replaceForDocument: () => Promise.resolve([]),
};

Deno.test("tag API maps update conflicts to HTTP 409", async () => {
  const response = await patchTag(
    new Request("http://localhost/__sadoku/tags/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "API", backgroundColor: "#123456" }),
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

Deno.test("tag API rejects an invalid background color", async () => {
  const response = await patchTag(
    new Request("http://localhost/__sadoku/tags/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "API", backgroundColor: "red" }),
    }),
    1,
    store,
  );
  assertEquals(response.status, 400);
  assertEquals(
    await response.text(),
    "Tag background color must be a hexadecimal RGB color.",
  );
});
