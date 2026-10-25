import { assertEquals } from "@std/assert";
import { restoreDocumentRevision } from "./restore_document_revision.ts";

const document = () => ({
  id: 7,
  filePath: "/docs/a.md",
  relativePath: "a.md",
  title: "a.md",
  deleted: false,
});

Deno.test("restore preserves live edits before replacing with empty saved Markdown", async () => {
  const events: unknown[] = [];
  const target = document();
  await restoreDocumentRevision(target, 3, "live", {
    commentsStore: {
      read: () => Promise.resolve({ filePath: target.filePath, comments: [] }),
      write: () => Promise.resolve(),
    },
    revisions: {
      findRevision: (documentId, revisionId) => {
        assertEquals([documentId, revisionId], [7, 3]);
        return Promise.resolve({
          id: 3,
          recordedAt: "2026-10-24T00:00:00.000Z",
          markdown: "",
        });
      },
    },
    recordRevision: (id, markdown) => {
      events.push(["save", id, markdown]);
      return Promise.resolve();
    },
    restorer: {
      read: () => Promise.resolve("live"),
      replace: (path, markdown, expected) => {
        events.push(["replace", path, markdown, expected]);
        return Promise.resolve();
      },
    },
  });
  assertEquals(events, [["save", 7, "live"], [
    "replace",
    "/docs/a.md",
    "",
    "live",
  ], ["save", 7, ""]]);
});

Deno.test("restore rejects a missing revision, stale content or failed archival without writing", async () => {
  for (const failure of ["missing", "changed", "archive"]) {
    let writes = 0;
    const result = await Promise.allSettled([
      restoreDocumentRevision(document(), 3, "live", {
        commentsStore: {
          read: () =>
            Promise.resolve({ filePath: document().filePath, comments: [] }),
          write: () => Promise.resolve(),
        },
        revisions: {
          findRevision: () =>
            Promise.resolve(
              failure === "missing" ? undefined : {
                id: 3,
                recordedAt: "2026-10-24T00:00:00.000Z",
                markdown: "old",
              },
            ),
        },
        recordRevision: () => Promise.reject(new Error("storage failed")),
        restorer: {
          read: () =>
            Promise.resolve(failure === "changed" ? "new edits" : "live"),
          replace: () => {
            writes++;
            return Promise.resolve();
          },
        },
      }),
    ]);
    assertEquals(result[0].status, "rejected");
    if (result[0].status === "rejected" && failure !== "archive") {
      assertEquals(result[0].reason, {
        type: failure === "missing"
          ? "document_revision_not_found"
          : "restore_conflict",
      });
    }
    assertEquals(writes, 0);
  }
});
