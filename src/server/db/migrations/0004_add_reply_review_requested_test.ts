import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../connection.ts";
import { runMigrations } from "../migrations.ts";
import { createCommentTablesMigration } from "./0001_create_comment_tables.ts";
import { addCommentAuthorsMigration } from "./0002_add_comment_authors.ts";
import { addCommentResolverMigration } from "./0003_add_comment_resolver.ts";
import { addReplyReviewRequestedMigration } from "./0004_add_reply_review_requested.ts";

Deno.test("addReplyReviewRequestedMigration defaults and constrains review requests", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "comments.sqlite3"),
      migrate: [
        createCommentTablesMigration,
        addCommentAuthorsMigration,
        addCommentResolverMigration,
      ],
    });
    try {
      const timestamp = "2026-07-26T00:00:00.000Z";
      await database.execute(
        "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?)",
        ["/tmp/example.md", timestamp, timestamp],
      );
      await database.execute(
        "INSERT INTO comment (document_id, local_id, start_line, end_line, original_start_line, original_end_line, body, created_at, updated_at) VALUES (1, 1, 1, 1, 1, 1, ?, ?, ?)",
        ["Comment", timestamp, timestamp],
      );
      await database.execute(
        "INSERT INTO comment_reply (comment_id, local_id, body, created_at, updated_at) VALUES (1, 1, ?, ?, ?)",
        ["Reply", timestamp, timestamp],
      );

      assertEquals(
        await runMigrations(database, [
          createCommentTablesMigration,
          addCommentAuthorsMigration,
          addCommentResolverMigration,
          addReplyReviewRequestedMigration,
        ]),
        ["0004"],
      );
      assertEquals(
        (await database.execute("SELECT review_requested FROM comment_reply"))
          .rows,
        [{ review_requested: 0 }],
      );
      await database.execute(
        "UPDATE comment_reply SET review_requested = 1 WHERE id = 1",
      );
      await assertRejects(
        () => database.execute("UPDATE comment_reply SET review_requested = 2"),
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
