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
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('comment_documents', 'comments', 'comment_replies') ORDER BY name",
      );
      const indexes = await database.execute<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('idx_comment_documents_file_path', 'idx_comments_document_id', 'idx_comments_document_line', 'idx_comment_replies_comment_id') ORDER BY name",
      );

      assertEquals(tables.rows, [
        { name: "comment_documents" },
        { name: "comment_replies" },
        { name: "comments" },
      ]);
      assertEquals(indexes.rows, [
        { name: "idx_comment_documents_file_path" },
        { name: "idx_comment_replies_comment_id" },
        { name: "idx_comments_document_id" },
        { name: "idx_comments_document_line" },
      ]);

      await database.execute(
        "INSERT INTO comment_documents (file_path, created_at, updated_at) VALUES (?, ?, ?)",
        [
          "/tmp/example.md",
          "2026-07-04T00:00:00.000Z",
          "2026-07-04T00:00:00.000Z",
        ],
      );
      await database.execute(
        "INSERT INTO comments (document_id, local_id, line, original_line, body, created_at, updated_at) VALUES (1, 1, 2, 2, ?, ?, ?)",
        ["Comment", "2026-07-04T00:00:00.000Z", "2026-07-04T00:00:00.000Z"],
      );
      await database.execute(
        "INSERT INTO comment_replies (comment_id, local_id, body, created_at, updated_at) VALUES (1, 1, ?, ?, ?)",
        ["Reply", "2026-07-04T00:00:00.000Z", "2026-07-04T00:00:00.000Z"],
      );

      await database.execute("DELETE FROM comment_documents WHERE id = 1");

      assertEquals(
        (await database.execute<{ count: number }>(
          "SELECT COUNT(*) AS count FROM comments",
        )).rows,
        [{ count: 0 }],
      );
      assertEquals(
        (await database.execute<{ count: number }>(
          "SELECT COUNT(*) AS count FROM comment_replies",
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
