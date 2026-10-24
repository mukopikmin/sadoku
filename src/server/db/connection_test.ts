import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { dirname, join } from "@std/path";
import { withTempCommentsDirectory } from "../testing/helpers.ts";
import { getCommentsDirectoryPath } from "../storage/comment/storage.ts";
import { openAppDatabase } from "./connection.ts";

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

for (const mode of ["default", "nested override"] as const) {
  Deno.test(`openAppDatabase persists data at the ${mode} path`, async () => {
    await withTempCommentsDirectory(async () => {
      const commentsDirectory = getCommentsDirectoryPath();
      const databasePath = mode === "default"
        ? join(commentsDirectory, "sadoku.sqlite3")
        : join(commentsDirectory, "custom", "override.sqlite3");
      if (mode === "nested override") {
        assertEquals(await directoryExists(dirname(databasePath)), false);
      }
      const database = await openAppDatabase(
        mode === "default" ? {} : { path: databasePath },
      );
      try {
        assertEquals(database.path, databasePath);
        await database.execute("CREATE TABLE notes (body TEXT NOT NULL)");
        await database.execute("INSERT INTO notes (body) VALUES (?)", [
          "hello",
        ]);
        const result = await database.execute<{ body: string }>(
          "SELECT body FROM notes",
        );
        assertEquals(result.rows, [{ body: "hello" }]);
        assertEquals(await fileExists(databasePath), true);
        assertEquals(await directoryExists(dirname(databasePath)), true);
      } finally {
        database.close();
      }
    });
  });
}
