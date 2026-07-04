import { assertEquals } from "@std/assert";
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
      assertEquals(await fileExists(getDatabaseFilePath()), true);
    } finally {
      database.close();
    }
  });
});

Deno.test("openAppDatabase accepts a path override", async () => {
  const root = await Deno.makeTempDir();
  try {
    const databasePath = join(root, "custom", "override.sqlite3");
    const database = await openAppDatabase({ path: databasePath });
    try {
      assertEquals(database.path, databasePath);
    } finally {
      database.close();
    }

    assertEquals(await fileExists(databasePath), true);
    assertEquals(await directoryExists(dirname(databasePath)), true);
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
