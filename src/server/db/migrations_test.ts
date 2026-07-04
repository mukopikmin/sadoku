import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import type { AppDatabase, AppDatabaseStatementResult } from "./connection.ts";
import {
  calculateMigrationChecksum,
  ensureMigrationLedger,
  type Migration,
  MIGRATIONS,
  runMigrations,
} from "./migrations.ts";

interface ExecutedStatement {
  sql: string;
  parameters?: readonly unknown[];
}

type FakeDatabase = AppDatabase & {
  readonly statements: ExecutedStatement[];
  readonly appliedChecksums: Map<string, string>;
};

const createMigration = (
  version: string,
  name: string,
  up: (database: AppDatabase) => Promise<void> = () => Promise.resolve(),
): Migration => ({
  version,
  name,
  checksumSource: `${version}:${name}`,
  up,
});

const createFakeDatabase = (): FakeDatabase => {
  const statements: ExecutedStatement[] = [];
  const appliedChecksums = new Map<string, string>();

  return {
    statements,
    appliedChecksums,
    async execute<Row = Record<string, unknown>>(
      sql: string,
      parameters?: readonly unknown[],
    ): Promise<AppDatabaseStatementResult<Row>> {
      statements.push({ sql, parameters });

      if (sql.startsWith("SELECT version, checksum FROM")) {
        return {
          rows: [...appliedChecksums.entries()].sort().map((
            [version, checksum],
          ) => ({ version, checksum } as Row)),
        };
      }

      if (
        sql.startsWith("UPDATE") &&
        sql.includes("SET state = 'applied'") &&
        typeof parameters?.[1] === "string"
      ) {
        for (let index = statements.length - 1; index >= 0; index -= 1) {
          const statement = statements[index];
          if (
            statement?.sql.startsWith("INSERT OR REPLACE") &&
            statement.parameters?.[0] === parameters[1] &&
            typeof statement.parameters[2] === "string"
          ) {
            appliedChecksums.set(parameters[1], statement.parameters[2]);
            break;
          }
        }
      }

      return {};
    },
  };
};

Deno.test("MIGRATIONS includes the initial comment tables schema", async () => {
  const connection = createFakeDatabase();

  await MIGRATIONS[0].up(connection);

  const statements = connection.statements.map((statement) => statement.sql);
  assertEquals(MIGRATIONS[0].version, "0001");
  assertEquals(MIGRATIONS[0].name, "create_comment_tables");
  assertEquals(statements.length, 7);
  assertStringIncludes(
    statements[0] ?? "",
    "CREATE TABLE IF NOT EXISTS comment_documents",
  );
  assertStringIncludes(statements[1] ?? "", "idx_comment_documents_file_path");
  assertStringIncludes(
    statements[2] ?? "",
    "CREATE TABLE IF NOT EXISTS comments",
  );
  assertStringIncludes(
    statements[2] ?? "",
    "FOREIGN KEY (document_id) REFERENCES comment_documents(id) ON DELETE CASCADE",
  );
  assertStringIncludes(statements[3] ?? "", "idx_comments_document_id");
  assertStringIncludes(statements[4] ?? "", "idx_comments_document_line");
  assertStringIncludes(
    statements[5] ?? "",
    "CREATE TABLE IF NOT EXISTS comment_replies",
  );
  assertStringIncludes(
    statements[5] ?? "",
    "FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE",
  );
  assertStringIncludes(statements[6] ?? "", "idx_comment_replies_comment_id");
});

Deno.test("ensureMigrationLedger creates a constrained migration ledger", async () => {
  const connection = createFakeDatabase();

  await ensureMigrationLedger(connection);

  assertEquals(
    connection.statements[0]?.sql,
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY,name TEXT NOT NULL,checksum TEXT NOT NULL,state TEXT NOT NULL CHECK (state IN ('running', 'applied', 'failed')),started_at TEXT NOT NULL CHECK (started_at GLOB '????-??-??T??:??:??.???Z'),finished_at TEXT CHECK (finished_at IS NULL OR finished_at GLOB '????-??-??T??:??:??.???Z'),error_message TEXT)",
  );
});

Deno.test("calculateMigrationChecksum hashes checksumSource with SHA-256", async () => {
  assertEquals(
    await calculateMigrationChecksum({
      checksumSource: "0001:create documents",
    }),
    "dba21d6575e8a75a462ccfa74c08042bd108878c4c22d4f9299bf038e6e17a6d",
  );
});

Deno.test("runMigrations stores ledger timestamps as ISO 8601 strings", async () => {
  const connection = createFakeDatabase();

  await runMigrations(connection, [
    createMigration("0001", "create_documents"),
  ]);

  const runningStatement = connection.statements.find((statement) =>
    statement.sql.startsWith("INSERT OR REPLACE INTO schema_migrations")
  );
  const appliedStatement = connection.statements.find((statement) =>
    statement.sql.startsWith("UPDATE schema_migrations SET state = 'applied'")
  );
  const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  assertEquals(typeof runningStatement?.parameters?.[3], "string");
  assertEquals(
    iso8601Pattern.test(runningStatement?.parameters?.[3] as string),
    true,
  );
  assertEquals(typeof appliedStatement?.parameters?.[0], "string");
  assertEquals(
    iso8601Pattern.test(appliedStatement?.parameters?.[0] as string),
    true,
  );
});

Deno.test("runMigrations applies pending migrations in order", async () => {
  const connection = createFakeDatabase();
  const appliedByMigration: string[] = [];
  const migrations: Migration[] = [
    createMigration("0001", "create_documents", async () => {
      appliedByMigration.push("0001");
    }),
    createMigration("0002", "create_comments", async () => {
      appliedByMigration.push("0002");
    }),
  ];

  const applied = await runMigrations(connection, migrations);

  assertEquals(applied, ["0001", "0002"]);
  assertEquals(appliedByMigration, ["0001", "0002"]);
  assertEquals(
    connection.statements.map((statement) => statement.sql),
    [
      "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY,name TEXT NOT NULL,checksum TEXT NOT NULL,state TEXT NOT NULL CHECK (state IN ('running', 'applied', 'failed')),started_at TEXT NOT NULL CHECK (started_at GLOB '????-??-??T??:??:??.???Z'),finished_at TEXT CHECK (finished_at IS NULL OR finished_at GLOB '????-??-??T??:??:??.???Z'),error_message TEXT)",
      "SELECT version, checksum FROM schema_migrations WHERE state = 'applied' ORDER BY version",
      "INSERT OR REPLACE INTO schema_migrations (version, name, checksum, state, started_at, finished_at, error_message) VALUES (?, ?, ?, 'running', ?, NULL, NULL)",
      "BEGIN",
      "COMMIT",
      "UPDATE schema_migrations SET state = 'applied', finished_at = ? WHERE version = ?",
      "INSERT OR REPLACE INTO schema_migrations (version, name, checksum, state, started_at, finished_at, error_message) VALUES (?, ?, ?, 'running', ?, NULL, NULL)",
      "BEGIN",
      "COMMIT",
      "UPDATE schema_migrations SET state = 'applied', finished_at = ? WHERE version = ?",
    ],
  );
});

Deno.test("runMigrations skips already applied migrations with matching checksum", async () => {
  const connection = createFakeDatabase();
  const firstMigration = createMigration("0001", "create_documents");
  connection.appliedChecksums.set(
    "0001",
    await calculateMigrationChecksum(firstMigration),
  );
  const appliedByMigration: string[] = [];

  const applied = await runMigrations(connection, [
    {
      ...firstMigration,
      up: async () => {
        appliedByMigration.push("0001");
      },
    },
    createMigration("0002", "create_comments", async () => {
      appliedByMigration.push("0002");
    }),
  ]);

  assertEquals(applied, ["0002"]);
  assertEquals(appliedByMigration, ["0002"]);
});

Deno.test("runMigrations rejects edited applied migrations", async () => {
  const connection = createFakeDatabase();
  connection.appliedChecksums.set("0001", "previous-checksum");

  await assertRejects(
    () =>
      runMigrations(connection, [createMigration("0001", "create_documents")]),
    Error,
    "Do not edit existing migrations",
  );
});

Deno.test("runMigrations rolls back failed migrations", async () => {
  const connection = createFakeDatabase();

  await assertRejects(
    () =>
      runMigrations(connection, [
        createMigration("0001", "fails", () =>
          Promise.reject(new Error("migration failed"))),
      ]),
    Error,
    "migration failed",
  );

  assertEquals(
    connection.statements.map((statement) => statement.sql).slice(-3),
    [
      "BEGIN",
      "ROLLBACK",
      "UPDATE schema_migrations SET state = 'failed', finished_at = ?, error_message = ? WHERE version = ?",
    ],
  );
  assertEquals([...connection.appliedChecksums], []);
});

Deno.test("runMigrations rejects duplicate migration versions", async () => {
  await assertRejects(
    () =>
      runMigrations(createFakeDatabase(), [
        createMigration("0001", "duplicate"),
        createMigration("0001", "duplicate_again"),
      ]),
    Error,
    "Duplicate database migration version: 0001",
  );
});

Deno.test("runMigrations rejects non-zero-padded migration versions", async () => {
  await assertRejects(
    () => runMigrations(createFakeDatabase(), [createMigration("1", "bad")]),
    Error,
    "Use four zero-padded digits such as 0001",
  );
});

Deno.test("runMigrations rejects unsafe migration table names", async () => {
  await assertRejects(
    () =>
      runMigrations(createFakeDatabase(), [], {
        tableName: "schema_migrations; DROP TABLE comments",
      }),
    Error,
    "Invalid database identifier",
  );
});
