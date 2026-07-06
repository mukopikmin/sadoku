import {
  assert,
  assertEquals,
  assertExists,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import {
  type AppDatabase,
  type AppDatabaseConnection,
  type AppDatabaseStatementResult,
  openAppDatabase,
} from "./connection.ts";
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

const withTempDatabase = async <T>(
  operation: (database: AppDatabaseConnection) => Promise<T>,
): Promise<T> => {
  const directory = await Deno.makeTempDir({ prefix: "sadoku-migrations-" });
  const databasePath = `${directory}/comments.sqlite3`;
  const database = await openAppDatabase({
    path: databasePath,
    migrate: false,
  });

  try {
    return await operation(database);
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
};

const getTableNames = async (database: AppDatabase): Promise<string[]> => {
  const result = await database.execute<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  return result.rows?.map((row) => row.name) ?? [];
};

const getLedgerRows = async (
  database: AppDatabase,
): Promise<FakeLedgerRow[]> => {
  const result = await database.execute<FakeLedgerRow>(
    "SELECT version, name, checksum, state, started_at, finished_at, error_message FROM schema_migrations ORDER BY version",
  );
  return result.rows ?? [];
};

const insertLedgerRow = async (
  database: AppDatabase,
  row:
    & Pick<FakeLedgerRow, "version" | "name" | "checksum" | "state">
    & Partial<Pick<FakeLedgerRow, "error_message" | "finished_at">>,
): Promise<void> => {
  await ensureMigrationLedger(database);
  await database.execute(
    "INSERT INTO schema_migrations " +
      "(version, name, checksum, state, started_at, finished_at, error_message) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      row.version,
      row.name,
      row.checksum,
      row.state,
      "2026-01-01T00:00:00.000Z",
      row.finished_at ?? null,
      row.error_message ?? null,
    ],
  );
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
  assertStringIncludes(
    statements[4] ?? "",
    "idx_comments_document_start_line",
  );
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
    "sha256:dba21d6575e8a75a462ccfa74c08042bd108878c4c22d4f9299bf038e6e17a6d",
  );
});

Deno.test("runMigrations applies the initial migration to an empty SQLite database once", async () => {
  await withTempDatabase(async (database) => {
    const appliedFirst = await runMigrations(database);
    const tablesAfterFirstRun = await getTableNames(database);
    const rowsAfterFirstRun = await getLedgerRows(database);

    const appliedSecond = await runMigrations(database);
    const rowsAfterSecondRun = await getLedgerRows(database);

    assertEquals(appliedFirst, ["0001"]);
    assert(tablesAfterFirstRun.includes("schema_migrations"));
    assert(tablesAfterFirstRun.includes("comment_documents"));
    assert(tablesAfterFirstRun.includes("comments"));
    assert(tablesAfterFirstRun.includes("comment_replies"));
    assertEquals(rowsAfterFirstRun.length, 1);
    assertEquals(rowsAfterFirstRun[0]?.version, "0001");
    assertEquals(rowsAfterFirstRun[0]?.name, "create_comment_tables");
    assertEquals(rowsAfterFirstRun[0]?.state, "applied");
    assertExists(rowsAfterFirstRun[0]?.finished_at);
    assertEquals(rowsAfterFirstRun[0]?.error_message, null);
    assertEquals(appliedSecond, []);
    assertEquals(rowsAfterSecondRun, rowsAfterFirstRun);
  });
});

Deno.test("runMigrations stops startup when SQLite ledger contains failed or running migrations", async () => {
  await withTempDatabase(async (database) => {
    const migration = createMigration("0001", "create_documents");
    await insertLedgerRow(database, {
      version: migration.version,
      name: migration.name,
      checksum: await calculateMigrationChecksum(migration),
      state: "failed",
      finished_at: "2026-01-01T00:00:01.000Z",
      error_message: "migration failed",
    });

    await assertRejects(
      () => runMigrations(database, [migration]),
      Error,
      "marked failed",
    );
  });

  await withTempDatabase(async (database) => {
    const migration = createMigration("0001", "create_documents");
    await insertLedgerRow(database, {
      version: migration.version,
      name: migration.name,
      checksum: await calculateMigrationChecksum(migration),
      state: "running",
    });

    await assertRejects(
      () => runMigrations(database, [migration]),
      Error,
      "marked running",
    );
  });
});

Deno.test("runMigrations stops startup for SQLite ledger drift", async () => {
  await withTempDatabase(async (database) => {
    const migration = createMigration("0001", "create_documents");
    await insertLedgerRow(database, {
      version: migration.version,
      name: migration.name,
      checksum: "sha256:stale",
      state: "applied",
      finished_at: "2026-01-01T00:00:01.000Z",
    });

    await assertRejects(
      () => runMigrations(database, [migration]),
      Error,
      "checksum mismatch",
    );
  });

  await withTempDatabase(async (database) => {
    await insertLedgerRow(database, {
      version: "9999",
      name: "removed_migration",
      checksum: "sha256:removed",
      state: "applied",
      finished_at: "2026-01-01T00:00:01.000Z",
    });

    await assertRejects(
      () => runMigrations(database, []),
      Error,
      "exists in the ledger but not in code",
    );
  });
});

Deno.test("runMigrations records failed SQLite migrations and rolls back migration body", async () => {
  await withTempDatabase(async (database) => {
    const migration = createMigration("0001", "fails", async (connection) => {
      await connection.execute(
        "CREATE TABLE migration_body_should_rollback (id INTEGER PRIMARY KEY)",
      );
      await connection.execute(
        "INSERT INTO migration_body_should_rollback (id) VALUES (1)",
      );
      throw new Error("boom from migration body");
    });

    await assertRejects(
      () => runMigrations(database, [migration]),
      Error,
      "boom from migration body",
    );

    const rows = await getLedgerRows(database);
    const tables = await getTableNames(database);

    assertEquals(rows.length, 1);
    assertEquals(rows[0]?.version, "0001");
    assertEquals(rows[0]?.state, "failed");
    assertEquals(rows[0]?.error_message, "boom from migration body");
    assertExists(rows[0]?.finished_at);
    assertEquals(tables.includes("migration_body_should_rollback"), false);
  });
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
  const previousChecksum = "sha256:previous";
  const migration = createMigration("0001", "create_documents");
  const currentChecksum = await calculateMigrationChecksum(migration);
  connection.appliedChecksums.set("0001", previousChecksum);

  const error = await assertRejects(
    () => runMigrations(connection, [migration]),
    Error,
    "checksum mismatch",
  );

  assertEquals(
    error.message,
    "Applied database migration checksum mismatch: " +
      `version=0001, name=create_documents, expected=${previousChecksum}, ` +
      `actual=${currentChecksum}. ` +
      "Do not edit existing migrations; add a new migration instead.",
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
