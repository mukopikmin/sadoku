import { assertEquals } from "@std/assert";
import type { TagStore } from "./ports.ts";
import { renameTag } from "./rename_tag.ts";

const store: TagStore = {
  list: () => Promise.resolve([]),
  listForDocument: () => Promise.resolve([]),
  rename: (id, name) =>
    Promise.resolve({
      id,
      name,
      backgroundColor: "#718096",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    }),
  replaceForDocument: () => Promise.resolve([]),
  update: () => Promise.resolve({ type: "not_found", message: "unused" }),
};

Deno.test("rename tag validates and normalizes its name", async () => {
  const renamed = await renameTag(store, 1, "  API  ");
  if ("type" in renamed) throw new Error(renamed.message);
  assertEquals(renamed.name, "API");
  assertEquals(await renameTag(store, 0, "API"), {
    type: "invalid",
    message: "Tag id must be a positive integer.",
  });
  assertEquals(await renameTag(store, 1, " "), {
    type: "invalid",
    message: "Tag name must not be empty.",
  });
});
