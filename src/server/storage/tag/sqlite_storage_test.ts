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
    const renamed = await store.update(id, "Platform API", "#123456");
    if ("type" in renamed) throw new Error(renamed.message);
    assertEquals(renamed.name, "Platform API");
    assertEquals(renamed.backgroundColor, "#123456");
    const unchanged = await store.update(id, "Platform API", "#123456");
    if ("type" in unchanged) throw new Error(unchanged.message);
    assertEquals(unchanged.updatedAt, renamed.updatedAt);
    assertEquals((await store.listForDocument(2))[0].name, "Platform API");
    assertEquals(await store.update(first[1].id, "Platform API", "#abcdef"), {
      type: "conflict",
      message: "Tag name already exists.",
    });
    assertEquals((await store.listForDocument(2))[0].id, id);
    assertEquals(
      (await store.listForDocument(2))[0].backgroundColor,
      "#123456",
    );
    assertEquals(
      (await store.list()).map(({ name, documentCount }) => ({
        name,
        documentCount,
      })),
      [
        { name: "Platform API", documentCount: 2 },
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
        { name: "Platform API", documentCount: 1 },
        { name: "api", documentCount: 1 },
      ],
    );
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});
