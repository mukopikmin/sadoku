import { assertEquals } from "@std/assert";
import { addDocumentTags } from "./add_document_tags.ts";
import type { TagStore } from "./ports.ts";

Deno.test("addDocumentTags deduplicates IDs and supplies the document tag limit", async () => {
  const calls: unknown[][] = [];
  const store: Pick<TagStore, "addForDocument"> = {
    addForDocument: (...args) => {
      calls.push(args);
      return Promise.resolve({
        type: "not_found",
        message: "Document not found.",
      });
    },
  };
  assertEquals(await addDocumentTags(store, 1, [2, 2, 3]), {
    type: "not_found",
    message: "Document not found.",
  });
  assertEquals(calls, [[1, [2, 3], 20]]);
});

Deno.test("addDocumentTags rejects invalid document and tag IDs before storage", async () => {
  const store: Pick<TagStore, "addForDocument"> = {
    addForDocument: () =>
      Promise.reject(new Error("Unexpected addForDocument.")),
  };
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const result = await addDocumentTags(store, id, [1]);
    assertEquals(!Array.isArray(result) && result.type, "invalid");
    const invalidTag = await addDocumentTags(store, 1, [1, id]);
    assertEquals(!Array.isArray(invalidTag) && invalidTag.type, "invalid");
  }
  assertEquals(await addDocumentTags(store, 1, []), {
    type: "invalid",
    message: "At least one tag id is required.",
  });
});
