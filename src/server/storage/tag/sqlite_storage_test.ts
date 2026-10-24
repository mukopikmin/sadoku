import { assertEquals, assertFalse, assertRejects } from "@std/assert";
import { openAppDatabase } from "../../db/connection.ts";
import { createSqliteTagStore } from "./sqlite_storage.ts";

Deno.test("tag storage adds and deletes existing tags atomically without affecting other documents or tags", async () => {
  const directory = await Deno.makeTempDir();
  const database = await openAppDatabase({ path: `${directory}/test.sqlite3` });
  try {
    const now = new Date().toISOString();
    await database.execute(
      "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?), (?, ?, ?)",
      ["one.md", now, now, "two.md", now, now],
    );
    const store = createSqliteTagStore(database);
    for (const name of ["A", "B", "C"]) await store.create(name, "#123456");
    await store.addForDocument(1, [1], 20);
    await store.addForDocument(2, [1], 20);
    const added = await store.addForDocument(1, [1, 2, 2], 20);
    if (!Array.isArray(added)) throw new Error(added.message);
    assertEquals(added.map(({ id }) => id), [1, 2]);
    assertEquals(await store.addForDocument(1, [1, 2], 20), added);
    for (
      const operation of [
        () => store.addForDocument(1, [3, 999], 20),
        () => store.deleteForDocument(1, [1, 999]),
      ]
    ) {
      assertEquals(await operation(), {
        type: "not_found",
        message: "Tag 999 not found.",
      });
      assertEquals(await store.listForDocument(1), added);
    }
    assertEquals(await store.addForDocument(999, [1], 20), {
      type: "not_found",
      message: "Document not found.",
    });
    assertEquals(await store.deleteForDocument(999, [1]), {
      type: "not_found",
      message: "Document not found.",
    });
    assertEquals(await store.deleteForDocument(1, [3]), added);
    const remaining = await store.deleteForDocument(1, [1, 1]);
    if (!Array.isArray(remaining)) throw new Error(remaining.message);
    assertEquals(remaining.map(({ id }) => id), [2]);
    assertEquals((await store.listForDocument(2)).map(({ id }) => id), [1]);
    assertEquals((await store.list()).length, 3);
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("tag storage serializes incremental updates and enforces the total document tag limit", async () => {
  const directory = await Deno.makeTempDir();
  const database = await openAppDatabase({ path: `${directory}/test.sqlite3` });
  try {
    const now = new Date().toISOString();
    await database.execute(
      "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?)",
      ["one.md", now, now],
    );
    const store = createSqliteTagStore(database);
    for (let i = 1; i <= 21; i++) {
      await store.create(`Tag ${String(i).padStart(2, "0")}`, "#123456");
    }
    const initialIds = Array.from({ length: 19 }, (_, i) => i + 1);
    await Promise.all(
      initialIds.map((id) => store.addForDocument(1, [id], 20)),
    );
    assertEquals((await store.listForDocument(1)).length, 19);
    const results = await Promise.all([
      store.addForDocument(1, [20], 20),
      store.addForDocument(1, [21], 20),
    ]);
    assertEquals(results.filter(Array.isArray).length, 1);
    assertEquals(results.find((result) => !Array.isArray(result)), {
      type: "invalid",
      message: "A document can have at most 20 tags.",
    });
    assertEquals((await store.listForDocument(1)).map(({ id }) => id), [
      ...initialIds,
      20,
    ]);
    assertEquals(
      await store.addForDocument(1, [1, 1], 20),
      await store.listForDocument(1),
    );
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("tag storage rolls back incremental updates when an individual write fails", async () => {
  const directory = await Deno.makeTempDir();
  const database = await openAppDatabase({ path: `${directory}/test.sqlite3` });
  try {
    const now = new Date().toISOString();
    await database.execute(
      "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?)",
      ["one.md", now, now],
    );
    const store = createSqliteTagStore(database);
    await store.create("A", "#123456");
    await store.create("B", "#123456");
    for (const operation of ["add", "delete"] as const) {
      if (operation === "delete") await store.addForDocument(1, [1, 2], 20);
      const before = await store.listForDocument(1);
      let writes = 0;
      const failing = createSqliteTagStore({
        execute: (sql, parameters) => {
          if (
            sql.startsWith(
              operation === "add"
                ? "INSERT INTO document_tag_link"
                : "DELETE FROM document_tag_link",
            ) && ++writes === 2
          ) {
            throw new Error("Injected write failure.");
          }
          return database.execute(sql, parameters);
        },
      });
      await assertRejects(
        () =>
          operation === "add"
            ? failing.addForDocument(1, [1, 2], 20)
            : failing.deleteForDocument(1, [1, 2]),
        Error,
        "Injected write failure.",
      );
      assertEquals(await store.listForDocument(1), before);
    }
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("tag storage creates standalone tags, rejects duplicate names, and deletes associations", async () => {
  const directory = await Deno.makeTempDir();
  const database = await openAppDatabase({ path: `${directory}/test.sqlite3` });
  try {
    const store = createSqliteTagStore(database);
    assertEquals(await store.list(), []);
    const created = await store.create("API", "#123456");
    if ("type" in created) throw new Error(created.message);
    assertEquals(await store.list(), [{ ...created, documentCount: 0 }]);
    assertEquals(await store.create("API", "#abcdef"), {
      type: "conflict",
      message: "Tag name already exists.",
    });
    assertEquals(await store.list(), [{ ...created, documentCount: 0 }]);
    const now = new Date().toISOString();
    await database.execute(
      "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?), (?, ?, ?)",
      ["one.md", now, now, "two.md", now, now],
    );
    await store.replaceForDocument(1, [{ name: "API" }, { name: "Other" }]);
    await store.replaceForDocument(2, [{ id: created.id }]);
    assertEquals((await store.list())[0].documentCount, 2);
    assertEquals(await store.delete(created.id), undefined);
    assertEquals((await store.listForDocument(1)).map(({ name }) => name), [
      "Other",
    ]);
    assertEquals(await store.listForDocument(2), []);
    assertFalse((await store.list()).some(({ id }) => id === created.id));
    assertEquals(
      (await database.execute("SELECT id FROM comment_document")).rows?.length,
      2,
    );
    assertEquals(await store.delete(created.id), {
      type: "not_found",
      message: `Tag ${created.id} not found.`,
    });
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});

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
