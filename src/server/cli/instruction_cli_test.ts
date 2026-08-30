import { assertEquals, assertRejects } from "@std/assert";
import type { DocumentInstruction } from "../usecase/instruction/types.ts";
import type { InstructionStore } from "../usecase/instruction/ports.ts";
import {
  addInstruction,
  deleteInstruction,
  listInstructions,
  updateInstruction,
} from "./instruction_cli.ts";

const createStore = (): InstructionStore => {
  const instructions: DocumentInstruction[] = [];
  let nextId = 1;
  return {
    create: (documentId, content, now) => {
      const instruction = {
        content,
        createdAt: now,
        documentId,
        id: nextId++,
        updatedAt: now,
      };
      instructions.push(instruction);
      return Promise.resolve(instruction);
    },
    delete: (documentId, instructionId) => {
      const index = instructions.findIndex((item) =>
        item.documentId === documentId && item.id === instructionId
      );
      if (index < 0) return Promise.resolve(false);
      instructions.splice(index, 1);
      return Promise.resolve(true);
    },
    listByDocument: (documentId) =>
      Promise.resolve(
        instructions.filter((item) => item.documentId === documentId),
      ),
    update: (documentId, instructionId, content, now) => {
      const instruction = instructions.find((item) =>
        item.documentId === documentId && item.id === instructionId
      );
      if (!instruction) return Promise.resolve(undefined);
      instruction.content = content;
      instruction.updatedAt = now;
      return Promise.resolve(instruction);
    },
  };
};

Deno.test("instruction CLI performs CRUD and normalizes content", async () => {
  const store = createStore();
  const added = await addInstruction(1, "Review this.\r\n\r\n", store);
  assertEquals(added.content, "Review this.");
  assertEquals(await listInstructions(1, store), [added]);

  const updated = await updateInstruction(
    1,
    added.id,
    "Updated.\rNext.\n",
    store,
  );
  assertEquals(updated.content, "Updated.\nNext.");
  await deleteInstruction(1, added.id, store);
  assertEquals(await listInstructions(1, store), []);
});

Deno.test("instruction CLI maps empty content and missing IDs", async () => {
  const store = createStore();
  await assertRejects(
    () => addInstruction(1, " \n", store),
    Error,
    "Instruction content must not be empty.",
  );
  await assertRejects(
    () => updateInstruction(1, 99, "content", store),
    Error,
    "Instruction not found.",
  );
  await assertRejects(
    () => deleteInstruction(1, 99, store),
    Error,
    "Instruction not found.",
  );
});

Deno.test("instruction CLI rejects an ID belonging to another document", async () => {
  const store = createStore();
  const instruction = await addInstruction(1, "content", store);
  await assertRejects(
    () => updateInstruction(2, instruction.id, "other", store),
    Error,
    "Instruction not found.",
  );
  await assertRejects(
    () => deleteInstruction(2, instruction.id, store),
    Error,
    "Instruction not found.",
  );
});
