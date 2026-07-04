import { dirname, join } from "@std/path";
import { DatabaseSync } from "node:sqlite";
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

export interface AppDatabaseConnection extends DbConnection {
  close(): void;
}

export interface OpenAppDatabaseOptions {
  path?: string;
}

const databaseFileName = "sadoku.sqlite3";

export const getDatabaseFilePath = (): string =>
  join(getCommentsDirectoryPath(), databaseFileName);

const statementReturnsRows = (sql: string): boolean =>
  /^\s*(?:SELECT|PRAGMA\s+\w+\s*\()/i.test(sql);

class SqliteAppDatabase implements AppDatabaseConnection {
  readonly #database: DatabaseSync;

  constructor(path: string) {
    this.#database = new DatabaseSync(path);
  }

  async execute<Row = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<DbStatementResult<Row>> {
    const statement = this.#database.prepare(sql);

    if (statementReturnsRows(sql)) {
      return { rows: statement.all(...parameters) as Row[] };
    }

    const result = statement.run(...parameters);
    return { rowsAffected: Number(result.changes) };
  }

  close(): void {
    this.#database.close();
  }
}

export async function openAppDatabase(
  options: OpenAppDatabaseOptions = {},
): Promise<AppDatabaseConnection> {
  const databasePath = options.path ?? getDatabaseFilePath();
  await Deno.mkdir(dirname(databasePath), { recursive: true });
  return new SqliteAppDatabase(databasePath);
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
