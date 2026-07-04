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

const sql = (strings: TemplateStringsArray): string =>
  strings.raw.join("").replace(/\s+/g, " ").trim();

const createCommentTablesSql = [
  sql`
    CREATE TABLE IF NOT EXISTS comment_documents (
      id INTEGER PRIMARY KEY,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'),
      updated_at TEXT NOT NULL CHECK (updated_at GLOB '????-??-??T??:??:??.???Z')
    )
  `,
  sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_documents_file_path
      ON comment_documents(file_path)
  `,
  sql`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY,
      document_id INTEGER NOT NULL,
      local_id INTEGER NOT NULL,
      line INTEGER NOT NULL,
      original_line INTEGER NOT NULL,
      body TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0, 1)),
      resolved_at TEXT CHECK (resolved_at IS NULL OR resolved_at GLOB '????-??-??T??:??:??.???Z'),
      source_hash TEXT,
      source_text TEXT,
      stale INTEGER NOT NULL DEFAULT 0 CHECK (stale IN (0, 1)),
      created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'),
      updated_at TEXT NOT NULL CHECK (updated_at GLOB '????-??-??T??:??:??.???Z'),
      FOREIGN KEY (document_id)
        REFERENCES comment_documents(id)
        ON DELETE CASCADE,
      UNIQUE (document_id, local_id)
    )
  `,
  sql`
    CREATE INDEX IF NOT EXISTS idx_comments_document_id
      ON comments(document_id)
  `,
  sql`
    CREATE INDEX IF NOT EXISTS idx_comments_document_line
      ON comments(document_id, line)
  `,
  sql`
    CREATE TABLE IF NOT EXISTS comment_replies (
      id INTEGER PRIMARY KEY,
      comment_id INTEGER NOT NULL,
      local_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'),
      updated_at TEXT NOT NULL CHECK (updated_at GLOB '????-??-??T??:??:??.???Z'),
      FOREIGN KEY (comment_id)
        REFERENCES comments(id)
        ON DELETE CASCADE,
      UNIQUE (comment_id, local_id)
    )
  `,
  sql`
    CREATE INDEX IF NOT EXISTS idx_comment_replies_comment_id
      ON comment_replies(comment_id)
  `,
];

// Append-only application migrations. Once a migration is added, do not edit it;
// add a new zero-padded version instead (for example, 0001, 0002, ...).
export const MIGRATIONS: readonly Migration[] = [{
  version: "0001",
  name: "create_comment_tables",
  checksumSource: createCommentTablesSql.join(";\n"),
  up: async (database: AppDatabase): Promise<void> => {
    for (const sql of createCommentTablesSql) {
      await database.execute(sql);
    }
  },
}];

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
