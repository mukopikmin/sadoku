import { type AppDatabase, withTransaction } from "./connection.ts";

export interface Migration {
  version: string;
  name: string;
  checksumSource: string;
  up: (database: AppDatabase) => Promise<void>;
}

export type DbMigration = Migration;

export interface RunMigrationsOptions {
  tableName?: string;
}

const defaultMigrationsTableName = "schema_migrations";

// Append-only application migrations. Once a migration is added, do not edit it;
// add a new zero-padded version instead (for example, 0001, 0002, ...).
export const MIGRATIONS: readonly Migration[] = [];

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const migrationVersionPattern = /^\d{4}$/;
const iso8601SqlGlob = "????-??-??T??:??:??.???Z";

function assertValidIdentifier(identifier: string): void {
  if (!identifierPattern.test(identifier)) {
    throw new Error(`Invalid database identifier: ${identifier}`);
  }
}

function assertValidMigrationVersions(migrations: readonly Migration[]): void {
  for (const migration of migrations) {
    if (!migrationVersionPattern.test(migration.version)) {
      throw new Error(
        `Invalid database migration version: ${migration.version}. ` +
          "Use four zero-padded digits such as 0001.",
      );
    }
  }
}

function assertUniqueMigrationVersions(migrations: readonly Migration[]): void {
  const seen = new Set<string>();
  for (const migration of migrations) {
    if (seen.has(migration.version)) {
      throw new Error(
        `Duplicate database migration version: ${migration.version}`,
      );
    }
    seen.add(migration.version);
  }
}

export async function calculateMigrationChecksum(
  migration: Pick<Migration, "checksumSource">,
): Promise<string> {
  const bytes = new TextEncoder().encode(migration.checksumSource);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function ensureMigrationLedger(
  database: AppDatabase,
): Promise<void> {
  await database.execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations (" +
      "version TEXT PRIMARY KEY," +
      "name TEXT NOT NULL," +
      "checksum TEXT NOT NULL," +
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
      "name TEXT NOT NULL," +
      "checksum TEXT NOT NULL," +
      "state TEXT NOT NULL CHECK (state IN ('running', 'applied', 'failed'))," +
      `started_at TEXT NOT NULL CHECK (started_at GLOB '${iso8601SqlGlob}'),` +
      `finished_at TEXT CHECK (finished_at IS NULL OR finished_at GLOB '${iso8601SqlGlob}'),` +
      "error_message TEXT" +
      ")",
  );
}

async function readAppliedMigrationChecksums(
  database: AppDatabase,
  tableName: string,
): Promise<Map<string, string>> {
  const result = await database.execute<{ version: string; checksum: string }>(
    `SELECT version, checksum FROM ${tableName} WHERE state = 'applied' ORDER BY version`,
  );
  return new Map((result.rows ?? []).map((row) => [row.version, row.checksum]));
}

export async function runMigrations(
  database: AppDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
  options: RunMigrationsOptions = {},
): Promise<string[]> {
  const tableName = options.tableName ?? defaultMigrationsTableName;
  assertValidIdentifier(tableName);
  assertValidMigrationVersions(migrations);
  assertUniqueMigrationVersions(migrations);

  await ensureMigrationsTable(database, tableName);
  const appliedChecksums = await readAppliedMigrationChecksums(
    database,
    tableName,
  );
  const appliedNow: string[] = [];

  for (const migration of migrations) {
    const checksum = await calculateMigrationChecksum(migration);
    const appliedChecksum = appliedChecksums.get(migration.version);
    if (appliedChecksum !== undefined) {
      if (appliedChecksum !== checksum) {
        throw new Error(
          `Applied database migration ${migration.version} checksum mismatch. ` +
            "Do not edit existing migrations; add a new migration instead.",
        );
      }
      continue;
    }

    const startedAt = new Date().toISOString();
    await database.execute(
      `INSERT OR REPLACE INTO ${tableName} ` +
        "(version, name, checksum, state, started_at, finished_at, error_message) " +
        "VALUES (?, ?, ?, 'running', ?, NULL, NULL)",
      [migration.version, migration.name, checksum, startedAt],
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
          migration.version,
        ],
      );
      throw error;
    }

    await database.execute(
      `UPDATE ${tableName} SET state = 'applied', finished_at = ? ` +
        "WHERE version = ?",
      [new Date().toISOString(), migration.version],
    );

    appliedChecksums.set(migration.version, checksum);
    appliedNow.push(migration.version);
  }

  return appliedNow;
}
