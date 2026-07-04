import { assertEquals, assertRejects } from "@std/assert";
import type { AppDatabase, AppDatabaseStatementResult } from "./connection.ts";
import {
  type DbMigration,
  ensureMigrationLedger,
  runMigrations,
} from "./migrations.ts";

interface ExecutedStatement {
  sql: string;
  parameters?: readonly unknown[];
}

type FakeDatabase = AppDatabase & {
  readonly statements: ExecutedStatement[];
  readonly appliedIds: Set<string>;
};

const createFakeDatabase = (): FakeDatabase => {
  const statements: ExecutedStatement[] = [];
  const appliedIds = new Set<string>();

  return {
    statements,
    appliedIds,
    async execute<Row = Record<string, unknown>>(
      sql: string,
      parameters?: readonly unknown[],
    ): Promise<AppDatabaseStatementResult<Row>> {
      statements.push({ sql, parameters });

      if (sql.startsWith("SELECT version FROM")) {
        return {
          rows: [...appliedIds].sort().map((id) => ({ version: id } as Row)),
        };
      }

      if (
        sql.startsWith("UPDATE") &&
        sql.includes("SET state = 'applied'") &&
        typeof parameters?.[1] === "string"
      ) {
        appliedIds.add(parameters[1]);
      }

      return {};
    },
  };
};

Deno.test("ensureMigrationLedger creates a constrained migration ledger", async () => {
  const connection = createFakeDatabase();

  await ensureMigrationLedger(connection);

  assertEquals(
    connection.statements[0]?.sql,
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY,state TEXT NOT NULL CHECK (state IN ('running', 'applied', 'failed')),started_at TEXT NOT NULL CHECK (started_at GLOB '????-??-??T??:??:??.???Z'),finished_at TEXT CHECK (finished_at IS NULL OR finished_at GLOB '????-??-??T??:??:??.???Z'),error_message TEXT)",
  );
});

Deno.test("runMigrations stores ledger timestamps as ISO 8601 strings", async () => {
  const connection = createFakeDatabase();

  await runMigrations(connection, [{
    id: "001_create_documents",
    up: () => Promise.resolve(),
  }]);

  const runningStatement = connection.statements.find((statement) =>
    statement.sql.startsWith("INSERT OR REPLACE INTO schema_migrations")
  );
  const appliedStatement = connection.statements.find((statement) =>
    statement.sql.startsWith("UPDATE schema_migrations SET state = 'applied'")
  );
  const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  assertEquals(typeof runningStatement?.parameters?.[1], "string");
  assertEquals(
    iso8601Pattern.test(runningStatement?.parameters?.[1] as string),
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
  const migrations: DbMigration[] = [
    {
      id: "001_create_documents",
      up: async () => {
        appliedByMigration.push("001_create_documents");
      },
    },
    {
      id: "002_create_comments",
      up: async () => {
        appliedByMigration.push("002_create_comments");
      },
    },
  ];

  const applied = await runMigrations(connection, migrations);

  assertEquals(applied, ["001_create_documents", "002_create_comments"]);
  assertEquals(appliedByMigration, [
    "001_create_documents",
    "002_create_comments",
  ]);
  assertEquals(
    connection.statements.map((statement) => statement.sql),
    [
      "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY,state TEXT NOT NULL CHECK (state IN ('running', 'applied', 'failed')),started_at TEXT NOT NULL CHECK (started_at GLOB '????-??-??T??:??:??.???Z'),finished_at TEXT CHECK (finished_at IS NULL OR finished_at GLOB '????-??-??T??:??:??.???Z'),error_message TEXT)",
      "SELECT version FROM schema_migrations WHERE state = 'applied' ORDER BY version",
      "INSERT OR REPLACE INTO schema_migrations (version, state, started_at, finished_at, error_message) VALUES (?, 'running', ?, NULL, NULL)",
      "BEGIN",
      "COMMIT",
      "UPDATE schema_migrations SET state = 'applied', finished_at = ? WHERE version = ?",
      "INSERT OR REPLACE INTO schema_migrations (version, state, started_at, finished_at, error_message) VALUES (?, 'running', ?, NULL, NULL)",
      "BEGIN",
      "COMMIT",
      "UPDATE schema_migrations SET state = 'applied', finished_at = ? WHERE version = ?",
    ],
  );
});

Deno.test("runMigrations skips already applied migrations", async () => {
  const connection = createFakeDatabase();
  connection.appliedIds.add("001_create_documents");
  const appliedByMigration: string[] = [];

  const applied = await runMigrations(connection, [
    {
      id: "001_create_documents",
      up: async () => {
        appliedByMigration.push("001_create_documents");
      },
    },
    {
      id: "002_create_comments",
      up: async () => {
        appliedByMigration.push("002_create_comments");
      },
    },
  ]);

  assertEquals(applied, ["002_create_comments"]);
  assertEquals(appliedByMigration, ["002_create_comments"]);
});

Deno.test("runMigrations rolls back failed migrations", async () => {
  const connection = createFakeDatabase();

  await assertRejects(
    () =>
      runMigrations(connection, [{
        id: "001_fails",
        up: () => Promise.reject(new Error("migration failed")),
      }]),
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
  assertEquals([...connection.appliedIds], []);
});

Deno.test("runMigrations rejects duplicate migration ids", async () => {
  await assertRejects(
    () =>
      runMigrations(createFakeDatabase(), [
        { id: "001_duplicate", up: () => Promise.resolve() },
        { id: "001_duplicate", up: () => Promise.resolve() },
      ]),
    Error,
    "Duplicate database migration id: 001_duplicate",
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
