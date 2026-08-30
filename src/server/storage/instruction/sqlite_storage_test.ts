import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../../db/connection.ts";
import { createSqliteDocumentStore } from "../document/sqlite_storage.ts";
import { createSqliteInstructionStore } from "./sqlite_storage.ts";

Deno.test("sqlite instruction store keeps instructions in creation order and scopes mutations to a document", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "comments.sqlite3"),
    });
    try {
      const documents = createSqliteDocumentStore(database);
      const instructions = createSqliteInstructionStore(database);
      const firstDocument = await documents.ensure("first.md");
      const secondDocument = await documents.ensure("second.md");
      const first = await instructions.create(
        firstDocument.id,
        "First",
        "2026-08-29T00:00:00.000Z",
      );
      const second = await instructions.create(
        firstDocument.id,
        "Second",
        "2026-08-29T00:00:01.000Z",
      );
      assertEquals(
        (await instructions.listByDocument(firstDocument.id)).map((
          { content },
        ) => content),
        ["First", "Second"],
      );
      assertEquals(
        await instructions.update(
          secondDocument.id,
          first.id,
          "Wrong",
          "2026-08-29T00:00:02.000Z",
        ),
        undefined,
      );
      assertEquals(
        await instructions.delete(secondDocument.id, second.id),
        false,
      );
      assertEquals(
        (await instructions.listByDocument(firstDocument.id)).map((
          { content },
        ) => content),
        ["First", "Second"],
      );
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
