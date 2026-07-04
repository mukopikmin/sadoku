import { assertEquals, assertRejects } from "@std/assert";
import type { AppDatabase, AppDatabaseStatementResult } from "./connection.ts";
import {
  calculateMigrationChecksum,
  ensureMigrationLedger,
  type Migration,
  runMigrations,
} from "./migrations.ts";

interface ExecutedStatement {
  sql: string;
  parameters?: readonly unknown[];
}

interface FakeLedgerRow {
  version: string;
  name: string;
  checksum: string;
  state: "running" | "applied" | "failed";
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
}

type FakeDatabase = AppDatabase & {
  readonly statements: ExecutedStatement[];
  readonly appliedChecksums: Map<string, string>;
  readonly ledgerRows: FakeLedgerRow[];
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
  const ledgerRows: FakeLedgerRow[] = [];

  return {
    statements,
    appliedChecksums,
    ledgerRows,
    async execute<Row = Record<string, unknown>>(
      sql: string,
      parameters?: readonly unknown[],
    ): Promise<AppDatabaseStatementResult<Row>> {
      statements.push({ sql, parameters });

      if (sql.startsWith("SELECT version, name, checksum, state")) {
        return {
          rows: [
            ...[...appliedChecksums.entries()].map(([version, checksum]) => ({
              version,
              name: `migration_${version}`,
              checksum,
              state: "applied" as const,
              started_at: "2026-01-01T00:00:00.000Z",
              finished_at: "2026-01-01T00:00:00.000Z",
              error_message: null,
            })),
            ...ledgerRows,
          ].sort((left, right) => left.version.localeCompare(right.version))
            .map((row) => row as Row),
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
      "SELECT version, name, checksum, state, started_at, finished_at, error_message FROM schema_migrations ORDER BY version",
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

Deno.test("runMigrations rejects failed ledger rows", async () => {
  const connection = createFakeDatabase();
  connection.ledgerRows.push({
    version: "0001",
    name: "create_documents",
    checksum: await calculateMigrationChecksum(
      createMigration("0001", "create_documents"),
    ),
    state: "failed",
    started_at: "2026-01-01T00:00:00.000Z",
    finished_at: "2026-01-01T00:00:01.000Z",
    error_message: "migration failed",
  });

  await assertRejects(
    () =>
      runMigrations(connection, [createMigration("0001", "create_documents")]),
    Error,
    "marked failed",
  );
});

Deno.test("runMigrations rejects running ledger rows", async () => {
  const connection = createFakeDatabase();
  connection.ledgerRows.push({
    version: "0001",
    name: "create_documents",
    checksum: await calculateMigrationChecksum(
      createMigration("0001", "create_documents"),
    ),
    state: "running",
    started_at: "2026-01-01T00:00:00.000Z",
    finished_at: null,
    error_message: null,
  });

  await assertRejects(
    () =>
      runMigrations(connection, [createMigration("0001", "create_documents")]),
    Error,
    "marked running",
  );
});

Deno.test("runMigrations rejects ledger rows missing from code", async () => {
  const connection = createFakeDatabase();
  connection.ledgerRows.push({
    version: "0001",
    name: "create_documents",
    checksum: "orphaned-checksum",
    state: "applied",
    started_at: "2026-01-01T00:00:00.000Z",
    finished_at: "2026-01-01T00:00:01.000Z",
    error_message: null,
  });

  await assertRejects(
    () => runMigrations(connection, []),
    Error,
    "exists in the ledger but not in code",
  );
});

Deno.test("runMigrations applies pending migrations sorted by version", async () => {
  const connection = createFakeDatabase();
  const appliedByMigration: string[] = [];

  const applied = await runMigrations(connection, [
    createMigration("0002", "create_comments", async () => {
      appliedByMigration.push("0002");
    }),
    createMigration("0001", "create_documents", async () => {
      appliedByMigration.push("0001");
    }),
  ]);

  assertEquals(applied, ["0001", "0002"]);
  assertEquals(appliedByMigration, ["0001", "0002"]);
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
