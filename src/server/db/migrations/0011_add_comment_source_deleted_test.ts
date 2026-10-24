import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../connection.ts";
import { MIGRATIONS, runMigrations } from "../migrations.ts";

Deno.test("source deletion migration preserves existing comments when upgrading from 0010", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "comments.db"),
      migrate: MIGRATIONS.filter((migration) => migration.version < "0011"),
    });
    try {
      const now = "2026-10-20T00:00:00.000Z";
      await database.execute(
        "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?)",
        ["test.md", now, now],
      );
      await database.execute(
        "INSERT INTO comment (document_id, local_id, start_line, end_line, original_start_line, original_end_line, body, created_at, updated_at) VALUES (1, 1, 1, 1, 1, 1, 'Review', ?, ?)",
        [now, now],
      );
      assertEquals(
        await runMigrations(
          database,
          MIGRATIONS.filter((migration) => migration.version <= "0011"),
        ),
        ["0011"],
      );
      assertEquals(
        (await database.execute("SELECT body, source_deleted FROM comment"))
          .rows,
        [{ body: "Review", source_deleted: 0 }],
      );
      await database.execute("UPDATE comment SET source_deleted = 1");
      assertEquals(
        (await database.execute("SELECT source_deleted FROM comment")).rows,
        [{ source_deleted: 1 }],
      );
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
