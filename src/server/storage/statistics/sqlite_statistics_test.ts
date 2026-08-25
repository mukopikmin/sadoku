import { assertEquals } from "@std/assert";
import { openAppDatabase } from "../../db/connection.ts";
import { createSqliteStatisticsReader } from "./sqlite_statistics.ts";

Deno.test("reads document, file size, and human and bot comment statistics", async () => {
  const path = await Deno.makeTempFile({ suffix: ".sqlite3" });
  const database = await openAppDatabase({ path });
  try {
    const timestamp = new Date().toISOString();
    await database.execute(
      "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?), (?, ?, ?)",
      ["/one.md", timestamp, timestamp, "/two.md", timestamp, timestamp],
    );
    for (
      const [localId, author] of [[1, "human"], [2, "bot"], [
        3,
        "human",
      ]] as const
    ) {
      await database.execute(
        `INSERT INTO comment (document_id, local_id, start_line, end_line,
          original_start_line, original_end_line, body, author_type, created_at, updated_at)
          VALUES (1, ?, 1, 1, 1, 1, 'body', ?, ?, ?)`,
        [localId, author, timestamp, timestamp],
      );
    }

    const statistics = await createSqliteStatisticsReader(database).read();

    assertEquals(statistics.documentCount, 2);
    assertEquals(statistics.commentCount, { bot: 1, human: 2 });
    assertEquals(statistics.databaseSize > 0, true);
  } finally {
    database.close();
    await Deno.remove(path);
  }
});
