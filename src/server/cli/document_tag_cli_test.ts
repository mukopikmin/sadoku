import { assertEquals, assertRejects } from "@std/assert";
import { addDocumentTags, deleteDocumentTags } from "./document_tag_cli.ts";

Deno.test("document tag CLI returns the same public tag fields as document inspection", async () => {
  const tag = {
    id: 1,
    name: "API",
    backgroundColor: "#123456",
    createdAt: "private",
    updatedAt: "private",
  };
  const added = await addDocumentTags(1, [1], {
    addForDocument: () => Promise.resolve([tag]),
  });
  const deleted = await deleteDocumentTags(1, [2], {
    deleteForDocument: () => Promise.resolve([tag]),
  });
  assertEquals(added, [{ id: 1, name: "API", backgroundColor: "#123456" }]);
  assertEquals(deleted, added);
});

Deno.test("document tag CLI maps domain failures to command errors", async () => {
  for (const type of ["invalid", "not_found", "conflict"] as const) {
    await assertRejects(
      () =>
        addDocumentTags(1, [1], {
          addForDocument: () =>
            Promise.resolve({ type, message: "Cannot add tags." }),
        }),
      Error,
      "Cannot add tags.",
    );
    await assertRejects(
      () =>
        deleteDocumentTags(1, [1], {
          deleteForDocument: () =>
            Promise.resolve({ type, message: "Cannot delete tags." }),
        }),
      Error,
      "Cannot delete tags.",
    );
  }
});
