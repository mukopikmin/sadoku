import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { type Client, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { PreviewService } from "../../gen/ts/sadoku/preview/v1/preview_pb.ts";
import { openAppDatabase } from "../../src/server/db/connection.ts";
import { createDirectoryPreviewHandler } from "../../src/server/directory_handler.ts";
import { createSqliteCommentsStore } from "../../src/server/storage/comment/sqlite_storage.ts";
import { createSqliteDocumentStore } from "../../src/server/storage/document/sqlite_storage.ts";
import { createSqliteInstructionStore } from "../../src/server/storage/instruction/sqlite_storage.ts";
import { createSqliteTagStore } from "../../src/server/storage/tag/sqlite_storage.ts";
import { serveHandlerInfo } from "../../src/server/test_helpers.ts";

const withMetadataPreview = async (
  run: (preview: {
    client: Client<typeof PreviewService>;
    documentId: bigint;
    otherDocumentId: bigint;
    handler: Deno.ServeHandler;
  }) => Promise<void>,
) => {
  const rootPath = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(rootPath, "test.sqlite3"),
    });
    try {
      const documents = createSqliteDocumentStore(database);
      const entries = await documents.ensureMany([
        join(rootPath, "review.md"),
        join(rootPath, "other.md"),
      ]);
      const sessionDocuments = entries.map((entry) => ({
        ...entry,
        deleted: false,
        relativePath: entry.filePath.slice(rootPath.length + 1),
        title: "Review",
      }));
      const handler = createDirectoryPreviewHandler(
        {
          rootPath,
          documents: sessionDocuments,
          documentsById: new Map(
            sessionDocuments.map((document) => [document.id, document]),
          ),
        },
        createSqliteCommentsStore(database),
        {},
        documents,
        createSqliteInstructionStore(database),
        createSqliteTagStore(database),
      );
      const client = createClient(
        PreviewService,
        createConnectTransport({
          baseUrl: "http://127.0.0.1:3334",
          useBinaryFormat: false,
          fetch: async (input, init) =>
            await handler(new Request(input, init), serveHandlerInfo),
        }),
      );
      await run({
        client,
        documentId: BigInt(entries[0].id),
        otherDocumentId: BigInt(entries[1].id),
        handler,
      });
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(rootPath, { recursive: true });
  }
};

Deno.test("Connect tags can be added, updated, and read back from SQLite", async () => {
  await withMetadataPreview(async ({ client, documentId, handler }) => {
    const { tags } = await client.replaceDocumentTags({
      documentId,
      tags: [{ reference: { case: "name", value: "Review" } }],
    });
    assertEquals(tags.length, 1);
    assertEquals(tags[0].name, "Review");
    const updated = await client.updateTag({
      id: tags[0].id,
      name: "Reviewed",
      backgroundColor: "#123456",
    });
    assertEquals(updated.name, "Reviewed");
    assertEquals(updated.backgroundColor, "#123456");
    const listed = await client.listDocuments({});
    assertEquals(
      listed.documents.find(({ id }) => id === documentId)?.tags,
      [updated],
    );
    const summary = (await client.listTags({})).tags[0];
    assertEquals(summary.documentCount, 1n);
    assertEquals(summary.createdAt.length > 0, true);
    assertEquals(summary.updatedAt.length > 0, true);
    const restResponse = await handler(
      new Request("http://127.0.0.1:3334/__sadoku/tags"),
      serveHandlerInfo,
    );
    assertEquals(restResponse.status, 200);
    assertEquals((await restResponse.json())[0].createdAt, summary.createdAt);
    assertEquals(
      (await client.replaceDocumentTags({ documentId, tags: [] })).tags,
      [],
    );
  });
});

Deno.test("Connect instructions remain readable after creation and update", async () => {
  await withMetadataPreview(
    async ({ client, documentId, otherDocumentId, handler }) => {
      assertEquals(
        (await client.listInstructions({ documentId })).instructions,
        [],
      );
      const created = await client.createInstruction({
        documentId,
        content: "Keep APIs stable.",
      });
      assertEquals(created.content, "Keep APIs stable.");
      assertEquals(created.createdAt.length > 0, true);
      assertEquals(created.updatedAt.length > 0, true);
      assertEquals(
        (await client.listInstructions({ documentId })).instructions,
        [created],
      );
      const updated = await client.updateInstruction({
        documentId,
        instructionId: created.id,
        content: "Keep public APIs stable.",
      });
      assertEquals(updated.id, created.id);
      assertEquals(updated.content, "Keep public APIs stable.");
      assertEquals(updated.createdAt, created.createdAt);
      assertEquals(
        (await client.listInstructions({ documentId })).instructions,
        [updated],
      );
      assertEquals(
        (await client.listInstructions({ documentId: otherDocumentId }))
          .instructions,
        [],
      );
      const restResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/documents/${documentId}/instructions`,
        ),
        serveHandlerInfo,
      );
      assertEquals(restResponse.status, 200);
      const restInstruction = (await restResponse.json()).instructions[0];
      assertEquals(restInstruction.documentId, Number(documentId));
      assertEquals(restInstruction.content, updated.content);
      await client.deleteInstruction({
        documentId,
        instructionId: created.id,
      });
      assertEquals(
        (await client.listInstructions({ documentId })).instructions,
        [],
      );
    },
  );
});
