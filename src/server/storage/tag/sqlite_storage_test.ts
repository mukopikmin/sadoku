import { assertEquals } from "@std/assert";
import { openAppDatabase } from "../../db/connection.ts";
import { createSqliteTagStore } from "./sqlite_storage.ts";

Deno.test("tag storage creates, reuses, and replaces document tag associations", async () => {
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
    assertEquals((await store.listForDocument(2))[0].id, id);
    assertEquals(
      (await store.list()).map(({ name, documentCount }) => ({
        name,
        documentCount,
      })),
      [
        { name: "API", documentCount: 2 },
        { name: "api", documentCount: 1 },
      ],
    );
    await store.replaceForDocument(1, [{ id: first[1].id }]);
    assertEquals(
      (await store.list()).map(({ name, documentCount }) => ({
        name,
        documentCount,
      })),
      [
        { name: "API", documentCount: 1 },
        { name: "api", documentCount: 1 },
      ],
    );
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});
