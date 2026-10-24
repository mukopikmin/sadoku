import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../connection.ts";
import { MIGRATIONS, runMigrations } from "../migrations.ts";
import { createSqliteCommentsStore } from "../../storage/comment/sqlite_storage.ts";
import { createSqliteDocumentStore } from "../../storage/document/sqlite_storage.ts";

Deno.test("document revisions migration preserves both snapshots, empty revisions and document relationships", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "comments.db"),
      migrate: MIGRATIONS.filter((migration) => migration.version < "0012"),
    });
    try {
      const timestamp = "2026-10-20T00:00:00.000Z";
      const fixtures = [
        ["both.md", "old", "current"],
        ["empty-previous.md", "", "current"],
        ["empty-current.md", "old", ""],
        ["current-only.md", null, "current"],
        ["previous-only.md", "old", null],
        ["missing.md", null, null],
        ["identical.md", "same", "same"],
      ] as const;
      for (const [path, previous, current] of fixtures) {
        await database.execute(
          `INSERT INTO comment_document
            (file_path, previous_source_snapshot, source_snapshot, title, created_at, updated_at)
            VALUES (?, ?, ?, 'Custom title', ?, ?)`,
          [path, previous, current, timestamp, timestamp],
        );
      }
      await database.execute(
        `INSERT INTO comment (id, document_id, local_id, start_line, end_line,
          original_start_line, original_end_line, body, created_at, updated_at)
          VALUES (10, 1, 1, 1, 1, 1, 1, 'Review', ?, ?)`,
        [timestamp, timestamp],
      );
      await database.execute(
        `INSERT INTO comment_reply (comment_id, local_id, body, created_at, updated_at)
          VALUES (10, 1, 'Reply', ?, ?)`,
        [timestamp, timestamp],
      );

      assertEquals(await runMigrations(database), ["0012"]);
      const comments = createSqliteCommentsStore(database);
      const documents = createSqliteDocumentStore(database);
      for (const [path, previous, current] of fixtures) {
        const stored = await comments.read(path);
        assertEquals(
          stored.previousSourceSnapshot,
          previous ?? undefined,
          path,
        );
        assertEquals(stored.sourceSnapshot, current ?? undefined, path);
        const document = await documents.findByFilePath(path);
        assertEquals(document?.displayTitle, "Custom title");
        assertEquals(
          await documents.readSnapshot!(document!.id),
          current ?? undefined,
          path,
        );
        assertEquals(
          (await database.execute<{ markdown: string }>(
            "SELECT markdown FROM document_revision WHERE document_id = ? ORDER BY id",
            [document!.id],
          )).rows?.map((row) => row.markdown),
          [...new Set([previous, current].filter((value) => value !== null))],
          path,
        );
      }
      const storedComment = (await comments.read("both.md")).comments[0];
      assertEquals(storedComment.body, "Review");
      assertEquals(storedComment.replies?.[0].body, "Reply");
      assertEquals(
        (await database.execute(
          "SELECT created_at, updated_at FROM comment_document WHERE id = 1",
        )).rows,
        [{ created_at: timestamp, updated_at: timestamp }],
      );
      const columns = (await database.execute<{ name: string }>(
        "PRAGMA table_info(comment_document)",
      )).rows?.map((column) => column.name);
      assertEquals(columns?.includes("source_snapshot"), false);
      assertEquals(columns?.includes("previous_source_snapshot"), false);
      assertEquals(
        (await database.execute("PRAGMA foreign_key_check")).rows,
        [],
      );
      assertEquals(await runMigrations(database), []);
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("fresh document revisions schema enforces references and cascades document deletion", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({ path: join(root, "comments.db") });
    try {
      const comments = createSqliteCommentsStore(database);
      await comments.write("document.md", {
        filePath: "document.md",
        comments: [],
        previousSourceSnapshot: "previous",
        sourceSnapshot: "current",
      });
      await assertRejects(() =>
        database.execute("UPDATE comment_document SET source_revision_id = -1")
      );
      await assertRejects(() =>
        database.execute("DELETE FROM document_revision")
      );
      await assertRejects(() =>
        database.execute(
          "INSERT INTO document_revision (document_id, markdown) VALUES (-1, 'orphan')",
        )
      );
      await comments.delete("document.md");
      assertEquals(
        (await database.execute("SELECT * FROM document_revision")).rows,
        [],
      );
      assertEquals(
        (await database.execute("PRAGMA foreign_key_check")).rows,
        [],
      );
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
