import { type DbConnection, withTransaction } from "./connection.ts";

export interface DbMigration {
  id: string;
  up: (connection: DbConnection) => Promise<void>;
}

export interface RunMigrationsOptions {
  tableName?: string;
}

const defaultMigrationsTableName = "schema_migrations";
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
  connection: DbConnection,
  tableName: string,
): Promise<void> {
  await connection.execute(
    `CREATE TABLE IF NOT EXISTS ${tableName} (` +
      "id TEXT PRIMARY KEY," +
      "applied_at TEXT NOT NULL" +
      ")",
  );
}

async function readAppliedMigrationIds(
  connection: DbConnection,
  tableName: string,
): Promise<Set<string>> {
  const result = await connection.execute<{ id: string }>(
    `SELECT id FROM ${tableName} ORDER BY id`,
  );
  return new Set((result.rows ?? []).map((row) => row.id));
}

export async function runMigrations(
  connection: DbConnection,
  migrations: readonly DbMigration[],
  options: RunMigrationsOptions = {},
): Promise<string[]> {
  const tableName = options.tableName ?? defaultMigrationsTableName;
  assertValidIdentifier(tableName);
  assertUniqueMigrationIds(migrations);

  await ensureMigrationsTable(connection, tableName);
  const appliedIds = await readAppliedMigrationIds(connection, tableName);
  const appliedNow: string[] = [];

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;

    await withTransaction(connection, async () => {
      await migration.up(connection);
      await connection.execute(
        `INSERT INTO ${tableName} (id, applied_at) VALUES (?, ?)`,
        [migration.id, new Date().toISOString()],
      );
    });

    appliedIds.add(migration.id);
    appliedNow.push(migration.id);
  }

  return appliedNow;
}
