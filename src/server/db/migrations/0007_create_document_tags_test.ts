import { assertEquals, assertRejects } from "@std/assert";
import { openAppDatabase } from "../connection.ts";

Deno.test("tag migration uses case-sensitive identity and unique links", async () => {
  const directory = await Deno.makeTempDir();
  const database = await openAppDatabase({ path: `${directory}/test.sqlite3` });
  try {
    const now = new Date().toISOString();
    await database.execute(
      "INSERT INTO document_tag (name, created_at, updated_at) VALUES (?, ?, ?)",
      ["API", now, now],
    );
    await database.execute(
      "INSERT INTO document_tag (name, created_at, updated_at) VALUES (?, ?, ?)",
      ["api", now, now],
    );
    assertEquals(
      (await database.execute("SELECT id FROM document_tag")).rows?.length,
      2,
    );
    await assertRejects(() =>
      database.execute(
        "INSERT INTO document_tag (name, created_at, updated_at) VALUES (?, ?, ?)",
        ["API", now, now],
      )
    );
    await assertRejects(() =>
      database.execute(
        "INSERT INTO document_tag (name, created_at, updated_at) VALUES (?, ?, ?)",
        ["invalid-created-at", "2026-08-30", now],
      )
    );
    await assertRejects(() =>
      database.execute(
        "INSERT INTO document_tag (name, created_at, updated_at) VALUES (?, ?, ?)",
        ["invalid-updated-at", now, "not-a-timestamp"],
      )
    );
    await database.execute(
      "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?)",
      ["doc.md", now, now],
    );
    await database.execute(
      "INSERT INTO document_tag_link (document_id, tag_id) VALUES (1, 1)",
    );
    await assertRejects(() =>
      database.execute(
        "INSERT INTO document_tag_link (document_id, tag_id) VALUES (1, 1)",
      )
    );
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});
