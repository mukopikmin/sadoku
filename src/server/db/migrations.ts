import { type AppDatabase, withTransaction } from "./connection.ts";

export interface DbMigration {
  id: string;
  up: (database: AppDatabase) => Promise<void>;
}

export interface RunMigrationsOptions {
  tableName?: string;
}

const defaultMigrationsTableName = "schema_migrations";
const appMigrations: readonly DbMigration[] = [];
const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const iso8601SqlGlob = "????-??-??T??:??:??.???Z";

function assertValidIdentifier(identifier: string): void {
  if (!identifierPattern.test(identifier)) {
    throw new Error(`Invalid database identifier: ${identifier}`);
  }
}

function assertUniqueMigrationIds(migrations: readonly DbMigration[]): void {
  const seen = new Set<string>();
  for (const migration of migrations) {
    if (seen.has(migration.id)) {
      throw new Error(`Duplicate database migration id: ${migration.id}`);
    }
    seen.add(migration.id);
  }
}

export async function ensureMigrationLedger(
  database: AppDatabase,
): Promise<void> {
  await database.execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations (" +
      "version TEXT PRIMARY KEY," +
      "state TEXT NOT NULL CHECK (state IN ('running', 'applied', 'failed'))," +
      `started_at TEXT NOT NULL CHECK (started_at GLOB '${iso8601SqlGlob}'),` +
      `finished_at TEXT CHECK (finished_at IS NULL OR finished_at GLOB '${iso8601SqlGlob}'),` +
      "error_message TEXT" +
      ")",
  );
}

async function ensureMigrationsTable(
  database: AppDatabase,
  tableName: string,
): Promise<void> {
  if (tableName === defaultMigrationsTableName) {
    await ensureMigrationLedger(database);
    return;
  }

  await database.execute(
    `CREATE TABLE IF NOT EXISTS ${tableName} (` +
      "version TEXT PRIMARY KEY," +
      "state TEXT NOT NULL CHECK (state IN ('running', 'applied', 'failed'))," +
      `started_at TEXT NOT NULL CHECK (started_at GLOB '${iso8601SqlGlob}'),` +
      `finished_at TEXT CHECK (finished_at IS NULL OR finished_at GLOB '${iso8601SqlGlob}'),` +
      "error_message TEXT" +
      ")",
  );
}

async function readAppliedMigrationIds(
  database: AppDatabase,
  tableName: string,
): Promise<Set<string>> {
  const result = await database.execute<{ version: string }>(
    `SELECT version FROM ${tableName} WHERE state = 'applied' ORDER BY version`,
  );
  return new Set((result.rows ?? []).map((row) => row.version));
}

export async function runMigrations(
  database: AppDatabase,
  migrations: readonly DbMigration[] = appMigrations,
  options: RunMigrationsOptions = {},
): Promise<string[]> {
  const tableName = options.tableName ?? defaultMigrationsTableName;
  assertValidIdentifier(tableName);
  assertUniqueMigrationIds(migrations);

  await ensureMigrationsTable(database, tableName);
  const appliedIds = await readAppliedMigrationIds(database, tableName);
  const appliedNow: string[] = [];

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;

    const startedAt = new Date().toISOString();
    await database.execute(
      `INSERT OR REPLACE INTO ${tableName} ` +
        "(version, state, started_at, finished_at, error_message) " +
        "VALUES (?, 'running', ?, NULL, NULL)",
      [migration.id, startedAt],
    );

    try {
      await withTransaction(database, async () => {
        await migration.up(database);
      });
    } catch (error) {
      await database.execute(
        `UPDATE ${tableName} ` +
          "SET state = 'failed', finished_at = ?, error_message = ? " +
          "WHERE version = ?",
        [
          new Date().toISOString(),
          error instanceof Error ? error.message : String(error),
          migration.id,
        ],
      );
      throw error;
    }

    await database.execute(
      `UPDATE ${tableName} SET state = 'applied', finished_at = ? ` +
        "WHERE version = ?",
      [new Date().toISOString(), migration.id],
    );

    appliedIds.add(migration.id);
    appliedNow.push(migration.id);
  }

  return appliedNow;
}
