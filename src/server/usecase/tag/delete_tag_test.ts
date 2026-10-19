import { assertEquals } from "@std/assert";
import type { TagStore } from "./ports.ts";
import { deleteTag } from "./delete_tag.ts";

Deno.test("deleteTag rejects invalid ids before calling storage", async () => {
  const deleted: number[] = [];
  const store: TagStore = {
    list: () => Promise.resolve([]),
    listForDocument: () => Promise.resolve([]),
    rename: () => Promise.resolve({ type: "not_found", message: "unused" }),
    update: () => Promise.resolve({ type: "not_found", message: "unused" }),
    replaceForDocument: () => Promise.resolve([]),
    delete: (id: number) => {
      deleted.push(id);
      return Promise.resolve();
    },
  };
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assertEquals(await deleteTag(store, id), {
      type: "invalid",
      message: "Tag id must be a positive integer.",
    });
  }
  assertEquals(deleted, []);
  assertEquals(await deleteTag(store, 7), undefined);
  assertEquals(deleted, [7]);
});
