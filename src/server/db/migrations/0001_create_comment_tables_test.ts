import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../connection.ts";
import { createCommentTablesMigration } from "./0001_create_comment_tables.ts";

Deno.test("createCommentTablesMigration creates comment tables, indexes, and cascading foreign keys", async () => {
  const root = await Deno.makeTempDir();
  try {
    const databasePath = join(root, "comments.sqlite3");
    const database = await openAppDatabase({
      path: databasePath,
      migrate: [createCommentTablesMigration],
    });
    try {
      const tables = await database.execute<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('comment_document', 'comment', 'comment_reply') ORDER BY name",
      );
      const indexes = await database.execute<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('idx_comment_document_file_path', 'idx_comment_document_id', 'idx_comment_document_start_line', 'idx_comment_reply_comment_id') ORDER BY name",
      );

      assertEquals(tables.rows, [
        { name: "comment" },
        { name: "comment_document" },
        { name: "comment_reply" },
      ]);
      assertEquals(indexes.rows, [
        { name: "idx_comment_document_file_path" },
        { name: "idx_comment_document_id" },
        { name: "idx_comment_document_start_line" },
        { name: "idx_comment_reply_comment_id" },
      ]);

      await database.execute(
        "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?)",
        [
          "/tmp/example.md",
          "2026-07-04T00:00:00.000Z",
          "2026-07-04T00:00:00.000Z",
        ],
      );
      await database.execute(
        "INSERT INTO comment (document_id, local_id, start_line, end_line, original_start_line, original_end_line, body, created_at, updated_at) VALUES (1, 1, 2, 2, 2, 2, ?, ?, ?)",
        ["Comment", "2026-07-04T00:00:00.000Z", "2026-07-04T00:00:00.000Z"],
      );
      await database.execute(
        "INSERT INTO comment_reply (comment_id, local_id, body, created_at, updated_at) VALUES (1, 1, ?, ?, ?)",
        ["Reply", "2026-07-04T00:00:00.000Z", "2026-07-04T00:00:00.000Z"],
      );

      await database.execute("DELETE FROM comment_document WHERE id = 1");

      assertEquals(
        (await database.execute<{ count: number }>(
          "SELECT COUNT(*) AS count FROM comment",
        )).rows,
        [{ count: 0 }],
      );
      assertEquals(
        (await database.execute<{ count: number }>(
          "SELECT COUNT(*) AS count FROM comment_reply",
        )).rows,
        [{ count: 0 }],
      );
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
