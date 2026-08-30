import { assertEquals } from "@std/assert";
import type { DocumentInstruction } from "../usecase/instruction/types.ts";
import {
  createInstruction,
  getInstructions,
  removeInstruction,
  replaceInstruction,
} from "./instruction_api.ts";

const createStore = () => {
  const values: DocumentInstruction[] = [];
  return {
    values,
    store: {
      create: (documentId: number, content: string, now: string) => {
        const instruction = {
          id: values.length + 1,
          documentId,
          content,
          createdAt: now,
          updatedAt: now,
        };
        values.push(instruction);
        return Promise.resolve(instruction);
      },
      delete: (documentId: number, id: number) => {
        const index = values.findIndex((value) =>
          value.documentId === documentId && value.id === id
        );
        if (index < 0) return Promise.resolve(false);
        values.splice(index, 1);
        return Promise.resolve(true);
      },
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

Deno.test("instruction API creates, lists, updates, and deletes document instructions", async () => {
  const { store } = createStore();
  const request = (content: unknown) =>
    new Request("http://localhost/instructions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
  const created = await createInstruction(
    request("Keep APIs stable."),
    7,
    store,
  );
  assertEquals(created.status, 201);
  assertEquals(created.headers.get("cache-control"), "no-store");
  assertEquals((await getInstructions(7, store)).status, 200);
  assertEquals(
    (await replaceInstruction(request("Keep public APIs stable."), 7, 1, store))
      .status,
    200,
  );
  assertEquals((await removeInstruction(7, 1, store)).status, 204);
  assertEquals((await removeInstruction(7, 1, store)).status, 404);
  assertEquals((await createInstruction(request("   "), 7, store)).status, 400);
  assertEquals((await createInstruction(request(42), 7, store)).status, 400);
});
