import { assertEquals } from "@std/assert";
import { getDocumentRevision } from "./get_document_revision.ts";

Deno.test("document revision lookup preserves empty Markdown and reports a missing revision", async () => {
  const revision = {
    id: 3,
    recordedAt: "2026-10-22T00:00:00.000Z",
    markdown: "",
  };
  assertEquals(
    await getDocumentRevision(7, 3, {
      findRevision: (documentId, revisionId) => {
        assertEquals([documentId, revisionId], [7, 3]);
        return Promise.resolve(revision);
      },
    }),
    revision,
  );
  const [missing] = await Promise.allSettled([
    getDocumentRevision(7, 99, {
      findRevision: () => Promise.resolve(undefined),
    }),
  ]);
  assertEquals(missing.status, "rejected");
  if (missing.status === "rejected") {
    assertEquals(missing.reason, { type: "document_revision_not_found" });
  }
});
