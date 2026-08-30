import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { addInstruction, deleteInstruction, updateInstruction } from "./mod.ts";
import type { DocumentInstruction } from "./types.ts";

const memoryStore = () => {
  const values: DocumentInstruction[] = [];
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

Deno.test("instruction use cases normalize line endings and reject empty content", async () => {
  const { store, values } = memoryStore();
  const deps = {
    instructionStore: store,
    now: () => "2026-08-29T00:00:00.000Z",
  };
  await addInstruction(deps, 1, "  Keep indentation.\r\n\r\n");
  assertEquals(values[0].content, "  Keep indentation.");
  assertThrows(() => addInstruction(deps, 1, " \n "));
  await updateInstruction(deps, 1, 1, "Updated");
  assertEquals(values[0].content, "Updated");
  await deleteInstruction(store, 1, 1);
  await assertRejects(() => deleteInstruction(store, 1, 1));
});
