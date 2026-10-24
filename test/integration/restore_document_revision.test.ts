import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../../src/server/db/connection.ts";
import { createSqliteDocumentStore } from "../../src/server/storage/document/sqlite_storage.ts";
import { createSqliteCommentsStore } from "../../src/server/storage/comment/sqlite_storage.ts";
import { createDirectoryPreviewHandler } from "../../src/server/directory_handler.ts";
import { createPreviewSession } from "../../src/server/directory_session.ts";
import { serveHandlerInfo } from "../../src/server/test_helpers.ts";

Deno.test("restore RPC writes a document-scoped revision and retains live contents in history", async () => {
  const root = await Deno.makeTempDir();
  const database = await openAppDatabase({ path: join(root, "data.sqlite3") });
  try {
    const path = join(root, "a.md");
    await Deno.writeTextFile(path, "initial");
    const store = createSqliteDocumentStore(database);
    const comments = createSqliteCommentsStore(database);
    const session = await createPreviewSession(path, store);
    const document = session.documents[0];
    await store.initializeSnapshot!(document.id, "initial");
    const revisionId = (await store.listRevisions!(document.id, 20))[0].id;
    const other = await store.ensure(join(root, "other.md"));
    await store.initializeSnapshot!(other.id, "foreign");
    const foreignId = (await store.listRevisions!(other.id, 20))[0].id;
    await Deno.writeTextFile(path, "live edits");
    const handler = createDirectoryPreviewHandler(session, comments, {}, store);
    const rpc = async (method: string, body: unknown) =>
      await handler(
        new Request(
          `http://127.0.0.1/sadoku.preview.v1.PreviewService/${method}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "connect-protocol-version": "1",
            },
            body: JSON.stringify(body),
          },
        ),
        serveHandlerInfo,
      );
    const input = {
      documentId: String(document.id),
      revisionId: String(revisionId),
      expectedMarkdown: "live edits",
    };
    const capability = await rpc("GetDocument", {
      documentId: input.documentId,
    });
    assertEquals((await capability.json()).canRestore, true);
    for (
      const [revision, expected, status] of [[foreignId, "live edits", 404], [
        0,
        "live edits",
        404,
      ], [revisionId, "stale", 409]] as const
    ) {
      const response = await rpc("RestoreDocumentRevision", {
        ...input,
        revisionId: String(revision),
        expectedMarkdown: expected,
      });
      assertEquals(response.status, status);
      assertEquals(response.headers.get("cache-control"), "no-store");
      await response.body?.cancel();
      assertEquals(await Deno.readTextFile(path), "live edits");
    }
    const restored = await rpc("RestoreDocumentRevision", input);
    assertEquals(restored.status, 200);
    await restored.body?.cancel();
    assertEquals(await Deno.readTextFile(path), "initial");
    const revisions = await store.listRevisions!(document.id, 20);
    assertEquals(
      await Promise.all(
        revisions.map(async ({ id }) =>
          (await store.findRevision!(document.id, id))!.markdown
        ),
      ),
      ["initial", "live edits", "initial"],
    );
    // Recreating a deleted file also updates its session listing immediately.
    await Deno.remove(path);
    document.deleted = true;
    const recreated = await rpc("RestoreDocumentRevision", {
      documentId: input.documentId,
      revisionId: String(revisions[1].id),
    });
    assertEquals(recreated.status, 200);
    await recreated.body?.cancel();
    assertEquals(document.deleted, false);
    assertEquals(await Deno.readTextFile(path), "live edits");
    assertEquals(await store.readSnapshot!(document.id), "live edits");
    const loaded = await rpc("GetDocument", { documentId: input.documentId });
    assertEquals((await loaded.json()).markdown, "live edits");
    const added = await rpc("CreateComment", {
      documentId: input.documentId,
      startLine: 1,
      endLine: 1,
      body: "Keep this comment",
    });
    assertEquals(added.status, 200);
    await added.body?.cancel();
    const withComment = await rpc("RestoreDocumentRevision", input);
    assertEquals(withComment.status, 200);
    await withComment.body?.cancel();
    const rebased = await comments.read(path);
    assertEquals(rebased.comments[0].body, "Keep this comment");
    assertEquals(rebased.comments[0].stale, false);
    assertEquals(rebased.comments[0].sourceText, "live edits");
    assertEquals(rebased.sourceSnapshot, "initial");
    assertEquals(await store.readSnapshot!(document.id), "initial");
    await Deno.remove(path);
    document.deleted = true;
    const deleted = await rpc("GetDocument", { documentId: input.documentId });
    assertEquals((await deleted.json()).markdown, "initial");
    const remote = "https://example.com/a.md";
    document.filePath = remote;
    const denied = await rpc("RestoreDocumentRevision", input);
    assertEquals(denied.status, 400);
    await denied.body?.cancel();
  } finally {
    database.close();
    await Deno.remove(root, { recursive: true });
  }
});
