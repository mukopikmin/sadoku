import { assertEquals } from "@std/assert";
import { listDocumentRevisions } from "./list_document_revisions.ts";

Deno.test("document revision listing requests the latest twenty summaries", async () => {
  const revisions = [{ id: 3, recordedAt: "2026-10-22T00:00:00.000Z" }];
  const calls: number[][] = [];
  assertEquals(
    await listDocumentRevisions(7, {
      listRevisions: (documentId, limit) => {
        calls.push([documentId, limit]);
        return Promise.resolve(revisions);
      },
    }),
    revisions,
  );
  assertEquals(calls, [[7, 20]]);
});
