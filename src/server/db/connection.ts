import { dirname, join } from "@std/path";
import { getCommentsDirectoryPath } from "../comments/storage.ts";

export interface DbStatementResult<Row = Record<string, unknown>> {
  rows?: Row[];
  rowsAffected?: number;
}

export interface DbConnection {
  execute<Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<DbStatementResult<Row>>;
}

export interface AppDatabaseConnection {
  readonly path: string;
  close(): void;
}

export interface OpenAppDatabaseOptions {
  path?: string;
}

const databaseFileName = "sadoku.sqlite3";

export const getDatabaseFilePath = (): string =>
  join(getCommentsDirectoryPath(), databaseFileName);

class FileAppDatabase implements AppDatabaseConnection {
  readonly path: string;
  readonly #file: Deno.FsFile;

  constructor(path: string, file: Deno.FsFile) {
    this.path = path;
    this.#file = file;
  }

  close(): void {
    this.#file.close();
  }
}

export async function openAppDatabase(
  options: OpenAppDatabaseOptions = {},
): Promise<AppDatabaseConnection> {
  const databasePath = options.path ?? getDatabaseFilePath();
  await Deno.mkdir(dirname(databasePath), { recursive: true });
  const file = await Deno.open(databasePath, {
    create: true,
    read: true,
    write: true,
  });
  return new FileAppDatabase(databasePath, file);
}

export async function withTransaction<T>(
  connection: DbConnection,
  operation: () => Promise<T>,
): Promise<T> {
  await connection.execute("BEGIN");
  try {
    const result = await operation();
    await connection.execute("COMMIT");
    return result;
  } catch (error) {
    await connection.execute("ROLLBACK");
    throw error;
  }
}
