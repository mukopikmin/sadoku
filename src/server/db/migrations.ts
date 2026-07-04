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

async function ensureMigrationsTable(
  database: AppDatabase,
  tableName: string,
): Promise<void> {
  await database.execute(
    `CREATE TABLE IF NOT EXISTS ${tableName} (` +
      "id TEXT PRIMARY KEY," +
      "applied_at TEXT NOT NULL" +
      ")",
  );
}

async function readAppliedMigrationIds(
  database: AppDatabase,
  tableName: string,
): Promise<Set<string>> {
  const result = await database.execute<{ id: string }>(
    `SELECT id FROM ${tableName} ORDER BY id`,
  );
  return new Set((result.rows ?? []).map((row) => row.id));
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

    await withTransaction(database, async () => {
      await migration.up(database);
      await database.execute(
        `INSERT INTO ${tableName} (id, applied_at) VALUES (?, ?)`,
        [migration.id, new Date().toISOString()],
      );
    });

    appliedIds.add(migration.id);
    appliedNow.push(migration.id);
  }

  return appliedNow;
}
