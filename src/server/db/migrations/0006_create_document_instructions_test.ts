import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../connection.ts";
import { runMigrations } from "../migrations.ts";
import { createCommentTablesMigration } from "./0001_create_comment_tables.ts";
import { createDocumentInstructionsMigration } from "./0006_create_document_instructions.ts";

Deno.test("createDocumentInstructionsMigration upgrades an existing database without nullable fields", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "comments.sqlite3"),
      migrate: [createCommentTablesMigration],
    });
    try {
      assertEquals(
        await runMigrations(database, [
          createCommentTablesMigration,
          createDocumentInstructionsMigration,
        ]),
        ["0006"],
      );
      const now = "2026-08-29T00:00:00.000Z";
      await database.execute(
        "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?)",
        ["/tmp/example.md", now, now],
      );
      await database.execute(
        "INSERT INTO document_instruction (document_id, content, created_at, updated_at) VALUES (1, ?, ?, ?)",
        ["Keep the public API stable.", now, now],
      );
      assertEquals(
        (await database.execute(
          "SELECT document_id, content FROM document_instruction",
        )).rows,
        [{ document_id: 1, content: "Keep the public API stable." }],
      );
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
