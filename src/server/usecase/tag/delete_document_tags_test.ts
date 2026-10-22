import { assertEquals } from "@std/assert";
import { deleteDocumentTags } from "./delete_document_tags.ts";
import type { TagStore } from "./ports.ts";

Deno.test("deleteDocumentTags deduplicates IDs and returns the remaining tags", async () => {
  const calls: unknown[][] = [];
  const store: Pick<TagStore, "deleteForDocument"> = {
    deleteForDocument: (...args) => {
      calls.push(args);
      return Promise.resolve([]);
    },
  };
  assertEquals(await deleteDocumentTags(store, 1, [2, 2, 3]), []);
  assertEquals(calls, [[1, [2, 3]]]);
});

Deno.test("deleteDocumentTags validates IDs before storage", async () => {
  const store: Pick<TagStore, "deleteForDocument"> = {
    deleteForDocument: () =>
      Promise.reject(new Error("Unexpected deleteForDocument.")),
  };
  for (
    const [documentId, ids] of [[0, [1]], [1, []], [1, [0]], [1, [
      1,
      Number.MAX_SAFE_INTEGER + 1,
    ]]] as const
  ) {
    const result = await deleteDocumentTags(store, documentId, ids);
    assertEquals(!Array.isArray(result) && result.type, "invalid");
  }
});
