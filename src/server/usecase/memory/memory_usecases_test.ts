import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { addMemory, deleteMemory, updateMemory } from "./mod.ts";
import type { DocumentMemory } from "./types.ts";

const memoryStore = () => {
  const values: DocumentMemory[] = [];
  return {
    values,
    store: {
      create: (documentId: number, content: string, now: string) => {
        const value = {
          id: values.length + 1,
          documentId,
          content,
          createdAt: now,
          updatedAt: now,
        };
        values.push(value);
        return Promise.resolve(value);
      },
      delete: (documentId: number, id: number) =>
        Promise.resolve(
          values.some((value, index) =>
            value.documentId === documentId && value.id === id &&
            Boolean(values.splice(index, 1))
          ),
        ),
      listByDocument: (documentId: number) =>
        Promise.resolve(
          values.filter((value) => value.documentId === documentId),
        ),
      update: (
        documentId: number,
        id: number,
        content: string,
        now: string,
      ) => {
        const value = values.find((candidate) =>
          candidate.documentId === documentId && candidate.id === id
        );
        if (!value) return Promise.resolve(undefined);
        value.content = content;
        value.updatedAt = now;
        return Promise.resolve(value);
      },
    },
  };
};

Deno.test("memory use cases normalize line endings and reject empty content", async () => {
  const { store, values } = memoryStore();
  const deps = {
    memoryStore: store,
    now: () => "2026-08-29T00:00:00.000Z",
  };
  await addMemory(deps, 1, "  Keep indentation.\r\n\r\n");
  assertEquals(values[0].content, "  Keep indentation.");
  assertThrows(() => addMemory(deps, 1, " \n "));
  await updateMemory(deps, 1, 1, "Updated");
  assertEquals(values[0].content, "Updated");
  await deleteMemory(store, 1, 1);
  await assertRejects(() => deleteMemory(store, 1, 1));
});
