import { assertEquals, assertRejects } from "@std/assert";
import type { DocumentMemory } from "../usecase/memory/types.ts";
import type { MemoryStore } from "../usecase/memory/ports.ts";
import {
  addMemory,
  deleteMemory,
  listMemories,
  updateMemory,
} from "./memory_cli.ts";

const createStore = (): MemoryStore => {
  const memories: DocumentMemory[] = [];
  let nextId = 1;
  return {
    create: (documentId, content, now) => {
      const memory = {
        content,
        createdAt: now,
        documentId,
        id: nextId++,
        updatedAt: now,
      };
      memories.push(memory);
      return Promise.resolve(memory);
    },
    delete: (documentId, memoryId) => {
      const index = memories.findIndex((item) =>
        item.documentId === documentId && item.id === memoryId
      );
      if (index < 0) return Promise.resolve(false);
      memories.splice(index, 1);
      return Promise.resolve(true);
    },
    listByDocument: (documentId) =>
      Promise.resolve(
        memories.filter((item) => item.documentId === documentId),
      ),
    update: (documentId, memoryId, content, now) => {
      const memory = memories.find((item) =>
        item.documentId === documentId && item.id === memoryId
      );
      if (!memory) return Promise.resolve(undefined);
      memory.content = content;
      memory.updatedAt = now;
      return Promise.resolve(memory);
    },
  };
};

Deno.test("memory CLI performs CRUD and normalizes content", async () => {
  const store = createStore();
  const added = await addMemory(1, "Review this.\r\n\r\n", store);
  assertEquals(added.content, "Review this.");
  assertEquals(await listMemories(1, store), [added]);

  const updated = await updateMemory(
    1,
    added.id,
    "Updated.\rNext.\n",
    store,
  );
  assertEquals(updated.content, "Updated.\nNext.");
  await deleteMemory(1, added.id, store);
  assertEquals(await listMemories(1, store), []);
});

Deno.test("memory CLI maps empty content and missing IDs", async () => {
  const store = createStore();
  await assertRejects(
    () => addMemory(1, " \n", store),
    Error,
    "Memory content must not be empty.",
  );
  await assertRejects(
    () => updateMemory(1, 99, "content", store),
    Error,
    "Memory not found.",
  );
  await assertRejects(
    () => deleteMemory(1, 99, store),
    Error,
    "Memory not found.",
  );
});

Deno.test("memory CLI rejects an ID belonging to another document", async () => {
  const store = createStore();
  const memory = await addMemory(1, "content", store);
  await assertRejects(
    () => updateMemory(2, memory.id, "other", store),
    Error,
    "Memory not found.",
  );
  await assertRejects(
    () => deleteMemory(2, memory.id, store),
    Error,
    "Memory not found.",
  );
});
