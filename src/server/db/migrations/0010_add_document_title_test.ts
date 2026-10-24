import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../connection.ts";
import { MIGRATIONS, runMigrations } from "../migrations.ts";
import { createSqliteDocumentStore } from "../../storage/document/sqlite_storage.ts";
import { createPreviewSession } from "../../directory_session.ts";
import { updateDocumentTitle } from "../../usecase/document/update_document_title.ts";

Deno.test("document titles survive migration and reopening without changing Markdown", async () => {
  const root = await Deno.makeTempDir();
  const path = join(root, "documents.db");
  const filePath = join(root, "guide.md");
  await Deno.writeTextFile(filePath, "# Body heading\n");
  try {
    const old = await openAppDatabase({
      path,
      migrate: MIGRATIONS.filter((migration) => migration.version < "0010"),
    });
    try {
      await old.execute(
        "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?)",
        [filePath, "2026-10-19T00:00:00.000Z", "2026-10-19T00:00:00.000Z"],
      );
      assertEquals(
        await runMigrations(
          old,
          MIGRATIONS.filter((migration) => migration.version <= "0010"),
        ),
        ["0010"],
      );
      const store = createSqliteDocumentStore(old);
      const session = await createPreviewSession(filePath, store);
      const document = session.documents[0];
      assertEquals(document.displayTitle, undefined);
      await updateDocumentTitle(document, " File title ", store);
      assertEquals(document.displayTitle, "File title");
    } finally {
      old.close();
    }
    const database = await openAppDatabase({ path });
    try {
      const store = createSqliteDocumentStore(database);
      const session = await createPreviewSession(root, store);
      const document = session.documents[0];
      assertEquals(document.displayTitle, "File title");
      assertEquals(
        (await store.findByFilePath(filePath))?.displayTitle,
        "File title",
      );
      await updateDocumentTitle(document, " ", store);
      assertEquals(
        (await store.findById(document.id))?.displayTitle,
        undefined,
      );
      assertEquals(await Deno.readTextFile(filePath), "# Body heading\n");
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("a fresh database supports optional document titles", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({
      path: join(root, "documents.db"),
    });
    try {
      const store = createSqliteDocumentStore(database);
      const document = await store.ensure("guide.md");
      assertEquals(document.displayTitle, undefined);
      await store.setTitle!(document.id, "File title");
      assertEquals((await store.ensure("guide.md")).displayTitle, "File title");
      assertEquals((await store.list())[0].displayTitle, "File title");
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
