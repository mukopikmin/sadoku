import { assertEquals } from "@std/assert";
import type { TagStore } from "./ports.ts";
import { updateTag } from "./update_tag.ts";

const updates: unknown[][] = [];
const store: TagStore = {
  list: () => Promise.resolve([]),
  listForDocument: () => Promise.resolve([]),
  rename: () => Promise.resolve({ type: "not_found", message: "unused" }),
  replaceForDocument: () => Promise.resolve([]),
  update: (id, name, backgroundColor) => {
    updates.push([id, name, backgroundColor]);
    return Promise.resolve({
      id,
      name: name ?? "API",
      backgroundColor: backgroundColor ?? "#718096",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  },
};

Deno.test("updateTag validates and normalizes name and background color", async () => {
  updates.length = 0;
  await updateTag(store, 1, " API ", "#A1B2C3");
  assertEquals(updates, [[1, "API", "#a1b2c3"]]);
  assertEquals(await updateTag(store, 1, "API", "rgb(1, 2, 3)"), {
    type: "invalid",
    message: "Tag background color must be a hexadecimal RGB color.",
  });
});
