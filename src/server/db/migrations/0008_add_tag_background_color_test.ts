import { assertEquals, assertRejects } from "@std/assert";
import { openAppDatabase } from "../connection.ts";
import { MIGRATIONS, runMigrations } from "../migrations.ts";
import { DEFAULT_TAG_BACKGROUND_COLOR } from "./0008_add_tag_background_color.ts";

const withDatabase = async (
  migrate: boolean | typeof MIGRATIONS,
  test: (
    database: Awaited<ReturnType<typeof openAppDatabase>>,
  ) => Promise<void>,
) => {
  const directory = await Deno.makeTempDir();
  const database = await openAppDatabase({
    path: `${directory}/test.sqlite3`,
    migrate,
  });
  try {
    await test(database);
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
};

Deno.test("tag background color is available in a fresh database", async () => {
  await withDatabase(MIGRATIONS, async (database) => {
    const now = new Date().toISOString();
    await database.execute(
      "INSERT INTO document_tag (name, created_at, updated_at) VALUES (?, ?, ?)",
      ["API", now, now],
    );
    const row = (await database.execute<{ background_color: string }>(
      "SELECT background_color FROM document_tag WHERE name = ?",
      ["API"],
    )).rows?.[0];
    assertEquals(row?.background_color, DEFAULT_TAG_BACKGROUND_COLOR);
    await assertRejects(() =>
      database.execute(
        "UPDATE document_tag SET background_color = ? WHERE name = ?",
        ["red", "API"],
      )
    );
  });
});

Deno.test("tag background color upgrades existing version 0007 tags", async () => {
  await withDatabase(MIGRATIONS.slice(0, 7), async (database) => {
    const now = new Date().toISOString();
    await database.execute(
      "INSERT INTO document_tag (name, created_at, updated_at) VALUES (?, ?, ?)",
      ["existing", now, now],
    );
    await runMigrations(database, MIGRATIONS);
    assertEquals(
      (await database.execute<{ background_color: string }>(
        "SELECT background_color FROM document_tag WHERE name = 'existing'",
      )).rows?.[0]?.background_color,
      DEFAULT_TAG_BACKGROUND_COLOR,
    );
  });
});
