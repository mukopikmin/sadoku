import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../../db/connection.ts";
import { createSqliteDocumentStore } from "./sqlite_storage.ts";
import { createSqliteCommentsStore } from "../comment/sqlite_storage.ts";

Deno.test("sqlite document store ensures documents and reuses IDs without updating them", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "documents.db"),
    });
    try {
      const store = createSqliteDocumentStore(database);
      const first = await store.ensure("/tmp/first.md");
      await database.execute(
        "UPDATE comment_document SET updated_at = ? WHERE id = ?",
        ["2020-01-01T00:00:00.000Z", first.id],
      );
      const repeated = await store.ensure("/tmp/first.md");
      const timestamp = (await database.execute<{ updated_at: string }>(
        "SELECT updated_at FROM comment_document WHERE id = ?",
        [first.id],
      )).rows?.[0]?.updated_at;

      assertEquals(repeated, first);
      assertEquals(timestamp, "2020-01-01T00:00:00.000Z");
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("sqlite document store preserves ensureMany order and duplicates", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "documents.db"),
    });
    try {
      const store = createSqliteDocumentStore(database);
      const documents = await store.ensureMany(["b.md", "a.md", "b.md"]);

      assertEquals(documents.map((document) => document.filePath), [
        "b.md",
        "a.md",
        "b.md",
      ]);
      assertEquals(documents[0].id, documents[2].id);
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("sqlite document store ensures a batch atomically", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "documents.db"),
    });
    try {
      const store = createSqliteDocumentStore(database);
      await database.execute(
        `CREATE TRIGGER reject_document BEFORE INSERT ON comment_document
          WHEN NEW.file_path = 'rejected.md'
          BEGIN SELECT RAISE(ABORT, 'rejected document'); END`,
      );

      await assertRejects(() =>
        store.ensureMany(["accepted.md", "rejected.md"])
      );
      assertEquals(await store.findByFilePath("accepted.md"), undefined);
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("sqlite document store finds documents by ID and file path", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "documents.db"),
    });
    try {
      const store = createSqliteDocumentStore(database);
      const document = await store.ensure("document.md");

      assertEquals(await store.findById(document.id), document);
      assertEquals(await store.findByFilePath(document.filePath), document);
      assertEquals(await store.findById(-1), undefined);
      assertEquals(await store.findByFilePath("missing.md"), undefined);
      assertEquals(await store.list(), [document]);
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("sqlite document store initializes a snapshot only once", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "documents.db"),
    });
    try {
      const store = createSqliteDocumentStore(database);
      const document = await store.ensure("document.md");
      assertEquals(await store.readSnapshot?.(document.id), undefined);

      await store.initializeSnapshot?.(document.id, "first");
      await store.initializeSnapshot?.(document.id, "second");

      assertEquals(await store.readSnapshot?.(document.id), "first");
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("sqlite document snapshot initialization is atomic and reuses the revision on comment writes", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "documents.db"),
    });
    try {
      const store = createSqliteDocumentStore(database);
      const comments = createSqliteCommentsStore(database);
      const document = await store.ensure("document.md");
      await database.execute(
        `CREATE TRIGGER reject_snapshot BEFORE UPDATE OF source_revision_id ON comment_document
          BEGIN SELECT RAISE(ABORT, 'rejected snapshot'); END`,
      );
      await assertRejects(() =>
        store.initializeSnapshot!(document.id, "rejected")
      );
      assertEquals(await store.readSnapshot!(document.id), undefined);
      assertEquals(
        (await database.execute("SELECT * FROM document_revision")).rows,
        [],
      );
      await database.execute("DROP TRIGGER reject_snapshot");
      await Promise.all([
        store.initializeSnapshot!(document.id, ""),
        store.initializeSnapshot!(document.id, "second"),
        store.initializeSnapshot!(-1, "missing document"),
      ]);
      assertEquals(await store.readSnapshot!(document.id), "");
      await comments.write(document.filePath, {
        filePath: document.filePath,
        comments: [],
        sourceSnapshot: "",
      });
      assertEquals(
        (await database.execute(
          "SELECT markdown FROM document_revision ORDER BY id",
        )).rows,
        [{ markdown: "" }],
      );
      await comments.write(document.filePath, {
        filePath: document.filePath,
        comments: [],
        previousSourceSnapshot: "",
        sourceSnapshot: "next",
      });
      assertEquals(await store.readSnapshot!(document.id), "next");
      assertEquals(
        (await comments.read(document.filePath)).previousSourceSnapshot,
        "",
      );
      assertEquals(
        (await database.execute(
          "SELECT markdown FROM document_revision ORDER BY id",
        )).rows,
        [{ markdown: "" }, { markdown: "next" }],
      );
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
