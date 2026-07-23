import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../connection.ts";
import { runMigrations } from "../migrations.ts";
import { createCommentTablesMigration } from "./0001_create_comment_tables.ts";
import { addCommentAuthorsMigration } from "./0002_add_comment_authors.ts";

Deno.test("addCommentResolverMigration preserves unknown resolvers and constrains known types", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "comments.sqlite3"),
      migrate: [createCommentTablesMigration, addCommentAuthorsMigration],
    });
    try {
      const timestamp = "2026-07-23T00:00:00.000Z";
      await database.execute(
        "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?)",
        ["/tmp/example.md", timestamp, timestamp],
      );
      await database.execute(
        "INSERT INTO comment (document_id, local_id, start_line, end_line, original_start_line, original_end_line, body, resolved, resolved_at, created_at, updated_at) VALUES (1, 1, 1, 1, 1, 1, ?, 1, ?, ?, ?)",
        ["Comment", timestamp, timestamp, timestamp],
      );

      assertEquals(await runMigrations(database), ["0003"]);
      assertEquals(
        (await database.execute("SELECT resolved_by_type FROM comment")).rows,
        [{ resolved_by_type: null }],
      );
      await database.execute(
        "UPDATE comment SET resolved_by_type = 'bot' WHERE id = 1",
      );
      await assertRejects(
        () =>
          database.execute(
            "UPDATE comment SET resolved_by_type = 'unknown' WHERE id = 1",
          ),
        Error,
        "CHECK constraint failed",
      );
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
