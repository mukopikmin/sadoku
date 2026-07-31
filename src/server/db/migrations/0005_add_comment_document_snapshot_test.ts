import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../connection.ts";
import { runMigrations } from "../migrations.ts";
import { createCommentTablesMigration } from "./0001_create_comment_tables.ts";
import { addCommentDocumentSnapshotMigration } from "./0005_add_comment_document_snapshot.ts";

Deno.test("addCommentDocumentSnapshotMigration preserves document snapshots", async () => {
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
          addCommentDocumentSnapshotMigration,
        ]),
        ["0005"],
      );
      const timestamp = "2026-07-29T00:00:00.000Z";
      await database.execute(
        "INSERT INTO comment_document (file_path, previous_source_snapshot, source_snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [
          "/tmp/example.md",
          "# Previous\n",
          "# Snapshot\n",
          timestamp,
          timestamp,
        ],
      );
      assertEquals(
        (await database.execute(
          "SELECT previous_source_snapshot, source_snapshot FROM comment_document",
        )).rows,
        [{
          previous_source_snapshot: "# Previous\n",
          source_snapshot: "# Snapshot\n",
        }],
      );
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
