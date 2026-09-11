import { assertEquals } from "@std/assert";
import type { DocumentMemory } from "../usecase/memory/types.ts";
import { getMemories, removeMemory } from "./memory_api.ts";

const values: DocumentMemory[] = [{
  id: 1,
  documentId: 7,
  content: "Stable context.",
  createdAt: "2026-09-11T00:00:00.000Z",
  updatedAt: "2026-09-11T00:00:00.000Z",
}];
const store = {
  create: () => Promise.resolve(values[0]),
  delete: (documentId: number, id: number) => {
    const index = values.findIndex((value) =>
      value.documentId === documentId && value.id === id
    );
    if (index < 0) return Promise.resolve(false);
    values.splice(index, 1);
    return Promise.resolve(true);
  },
  listByDocument: (documentId: number) =>
    Promise.resolve(values.filter((value) => value.documentId === documentId)),
  update: () => Promise.resolve(undefined),
};

Deno.test("memory API lists and deletes document memories", async () => {
  const listed = await getMemories(7, store);
  assertEquals(listed.status, 200);
  assertEquals(listed.headers.get("cache-control"), "no-store");
  assertEquals((await listed.json()).memories[0].content, "Stable context.");
  assertEquals((await removeMemory(8, 1, store)).status, 404);
  assertEquals((await removeMemory(7, 1, store)).status, 204);
  assertEquals((await removeMemory(7, 1, store)).status, 404);
});
