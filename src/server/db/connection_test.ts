import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { dirname, join } from "@std/path";
import { withTempCommentsDirectory } from "../test_helpers.ts";
import { getCommentsDirectoryPath } from "../comments/storage.ts";
import { getDatabaseFilePath, openAppDatabase } from "./connection.ts";

Deno.test("getDatabaseFilePath stores the SQLite database under the comments directory", async () => {
  await withTempCommentsDirectory(async () => {
    assertEquals(
      getDatabaseFilePath(),
      join(getCommentsDirectoryPath(), "sadoku.sqlite3"),
    );
  });
});

Deno.test("openAppDatabase opens the default application database path", async () => {
  await withTempCommentsDirectory(async () => {
    const database = await openAppDatabase();
    try {
      assertEquals(database.path, getDatabaseFilePath());
      await database.execute("CREATE TABLE notes (body TEXT NOT NULL)");
      await database.execute("INSERT INTO notes (body) VALUES (?)", ["hello"]);

      const result = await database.execute<{ body: string }>(
        "SELECT body FROM notes",
      );

      assertEquals(result.rows, [{ body: "hello" }]);
      assertEquals(await fileExists(getDatabaseFilePath()), true);
    } finally {
      database.close();
    }
  });
});

Deno.test("openAppDatabase creates a temp database at a path override", async () => {
  const root = await Deno.makeTempDir();
  try {
    const databasePath = join(root, "custom", "override.sqlite3");
    assertEquals(await directoryExists(dirname(databasePath)), false);

    const database = await openAppDatabase({ path: databasePath });
    try {
      assertEquals(database.path, databasePath);
      await database.execute("CREATE TABLE notes (body TEXT NOT NULL)");
    } finally {
      database.close();
    }

    assertEquals(await fileExists(databasePath), true);
    assertEquals(await directoryExists(dirname(databasePath)), true);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("openAppDatabase enables foreign keys and returns a migrated database", async () => {
  const root = await Deno.makeTempDir();
  try {
    const databasePath = join(root, "app.sqlite3");
    const database = await openAppDatabase({
      path: databasePath,
      migrate: [{
        version: "0001",
        name: "create_parent_child",
        checksumSource: "CREATE parent and child tables",
        up: async (connection) => {
          await connection.execute(
            "CREATE TABLE parent (id INTEGER PRIMARY KEY)",
          );
          await connection.execute(
            "CREATE TABLE child (parent_id INTEGER NOT NULL REFERENCES parent(id))",
          );
        },
      }],
    });
    try {
      const foreignKeys = await database.execute<{ foreign_keys: number }>(
        "PRAGMA foreign_keys",
      );
      const migrations = await database.execute<{ version: string }>(
        "SELECT version FROM schema_migration",
      );

      assertEquals(foreignKeys.rows, [{ foreign_keys: 1 }]);
      assertEquals(migrations.rows, [{ version: "0001" }]);
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("openAppDatabase can skip migrations for isolated tests", async () => {
  const root = await Deno.makeTempDir();
  try {
    const databasePath = join(root, "unmigrated.sqlite3");
    const database = await openAppDatabase({
      path: databasePath,
      migrate: false,
    });
    try {
      const tables = await database.execute<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      );

      assertEquals(tables.rows, []);
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("openAppDatabase closes the database when migrations fail", async () => {
  const root = await Deno.makeTempDir();
  try {
    const databasePath = join(root, "failed.sqlite3");
    let migrationConnection:
      | Awaited<ReturnType<typeof openAppDatabase>>
      | undefined;

    await assertRejects(
      () =>
        openAppDatabase({
          path: databasePath,
          migrate: [{
            version: "0001",
            name: "fails",
            checksumSource: "throw migration failed",
            up: (connection) => {
              migrationConnection = connection as Awaited<
                ReturnType<typeof openAppDatabase>
              >;
              return Promise.reject(new Error("migration failed"));
            },
          }],
        }),
      Error,
      "migration failed",
    );

    assertThrows(
      () => migrationConnection?.close(),
      Error,
      "database is not open",
    );
    await Deno.remove(databasePath);
    assertEquals(await fileExists(databasePath), false);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

const fileExists = async (path: string): Promise<boolean> => {
  try {
    return (await Deno.stat(path)).isFile;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
};

const directoryExists = async (path: string): Promise<boolean> => {
  try {
    return (await Deno.stat(path)).isDirectory;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
};
