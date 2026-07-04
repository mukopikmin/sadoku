import { assertEquals, assertRejects } from "@std/assert";
import type { DbConnection, DbStatementResult } from "./connection.ts";
import { type DbMigration, runMigrations } from "./migrations.ts";

interface ExecutedStatement {
  sql: string;
  parameters?: readonly unknown[];
}

class FakeConnection implements DbConnection {
  readonly statements: ExecutedStatement[] = [];
  readonly appliedIds = new Set<string>();

  async execute<Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<DbStatementResult<Row>> {
    this.statements.push({ sql, parameters });

    if (sql.startsWith("SELECT id FROM")) {
      return {
        rows: [...this.appliedIds].sort().map((id) => ({ id } as Row)),
      };
    }

    if (sql.startsWith("INSERT INTO") && typeof parameters?.[0] === "string") {
      this.appliedIds.add(parameters[0]);
    }

    return {};
  }
}

Deno.test("runMigrations applies pending migrations in order", async () => {
  const connection = new FakeConnection();
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
      "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY,applied_at TEXT NOT NULL)",
      "SELECT id FROM schema_migrations ORDER BY id",
      "BEGIN",
      "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
      "COMMIT",
      "BEGIN",
      "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
      "COMMIT",
    ],
  );
});

Deno.test("runMigrations skips already applied migrations", async () => {
  const connection = new FakeConnection();
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
  const connection = new FakeConnection();

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
    connection.statements.map((statement) => statement.sql).slice(-2),
    ["BEGIN", "ROLLBACK"],
  );
  assertEquals([...connection.appliedIds], []);
});

Deno.test("runMigrations rejects duplicate migration ids", async () => {
  await assertRejects(
    () =>
      runMigrations(new FakeConnection(), [
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
      runMigrations(new FakeConnection(), [], {
        tableName: "schema_migrations; DROP TABLE comments",
      }),
    Error,
    "Invalid database identifier",
  );
});
