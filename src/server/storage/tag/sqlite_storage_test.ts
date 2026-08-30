import { assertEquals } from "@std/assert";
import { openAppDatabase } from "../../db/connection.ts";
import { createSqliteTagStore } from "./sqlite_storage.ts";

Deno.test("tag storage replaces associations and renames shared tags without changing id", async () => {
  const directory = await Deno.makeTempDir();
  const database = await openAppDatabase({ path: `${directory}/test.sqlite3` });
  try {
    const now = new Date().toISOString();
    await database.execute(
      "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?), (?, ?, ?)",
      ["one.md", now, now, "two.md", now, now],
    );
    const store = createSqliteTagStore(database);
    const first = await store.replaceForDocument(1, [{ name: "API" }, {
      name: "api",
    }]);
    if (!Array.isArray(first)) throw new Error(first.message);
    assertEquals(first.map(({ name }) => name), ["API", "api"]);
    const id = first[0].id;
    await store.replaceForDocument(2, [{ id }]);
    const renamed = await store.rename(id, "Api");
    if ("type" in renamed) throw new Error(renamed.message);
    assertEquals(renamed.documentCount, 2);
    assertEquals((await store.listForDocument(1))[0], {
      ...first[0],
      name: "Api",
      updatedAt: renamed.updatedAt,
    });
    assertEquals((await store.listForDocument(2))[0].id, id);
    const conflict = await store.rename(id, "api");
    assertEquals("type" in conflict && conflict.type, "conflict");
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});
