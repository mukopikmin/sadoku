import { dirname, join } from "@std/path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
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
  readonly path: string;
  close(): void;
}

export interface OpenAppDatabaseOptions {
  path?: string;
}

const databaseFileName = "sadoku.sqlite3";

export const getDatabaseFilePath = (): string =>
  join(getCommentsDirectoryPath(), databaseFileName);

const statementReturnsRows = (sql: string): boolean =>
  /^\s*(?:SELECT|WITH|PRAGMA\s+\w+\s*\()/i.test(sql);

const normalizeRow = <Row>(row: unknown): Row =>
  Object.fromEntries(Object.entries(row as Record<string, unknown>)) as Row;

const createSqliteAppDatabase = (
  path: string,
  database: DatabaseSync,
): AppDatabaseConnection => ({
  path,
  async execute<Row = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<DbStatementResult<Row>> {
    const statement = database.prepare(sql);
    const sqliteParameters = parameters as readonly SQLInputValue[];

    if (statementReturnsRows(sql)) {
      return {
        rows: statement.all(...sqliteParameters).map(normalizeRow<Row>),
      };
    }

    const result = statement.run(...sqliteParameters);
    return { rowsAffected: Number(result.changes) };
  },
  close(): void {
    database.close();
  },
});

export async function openAppDatabase(
  options: OpenAppDatabaseOptions = {},
): Promise<AppDatabaseConnection> {
  const databasePath = options.path ?? getDatabaseFilePath();
  await Deno.mkdir(dirname(databasePath), { recursive: true });
  return createSqliteAppDatabase(databasePath, new DatabaseSync(databasePath));
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
