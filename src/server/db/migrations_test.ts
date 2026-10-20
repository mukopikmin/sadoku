import {
  assertEquals,
  assertExists,
  assertMatch,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import {
  type AppDatabase,
  type AppDatabaseConnection,
  openAppDatabase,
} from "./connection.ts";
import {
  calculateMigrationChecksum,
  ensureMigrationLedger,
  type Migration,
  runMigrations,
} from "./migrations.ts";

interface MigrationLedgerRow {
  version: string;
  name: string;
  checksum: string;
  state: "running" | "applied" | "failed";
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
}

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
): Promise<MigrationLedgerRow[]> => {
  const result = await database.execute<MigrationLedgerRow>(
    "SELECT version, name, checksum, state, started_at, finished_at, error_message FROM schema_migration ORDER BY version",
  );
  return result.rows ?? [];
};

const insertLedgerRow = async (
  database: AppDatabase,
  row:
    & Pick<MigrationLedgerRow, "version" | "name" | "checksum" | "state">
    & Partial<Pick<MigrationLedgerRow, "error_message" | "finished_at">>,
): Promise<void> => {
  await ensureMigrationLedger(database);
  await database.execute(
    "INSERT INTO schema_migration " +
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

const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

Deno.test("calculateMigrationChecksum hashes checksumSource with SHA-256", async () => {
  assertEquals(
    await calculateMigrationChecksum({
      checksumSource: "0001:create documents",
    }),
    "sha256:dba21d6575e8a75a462ccfa74c08042bd108878c4c22d4f9299bf038e6e17a6d",
  );
});

Deno.test("runMigrations applies all migrations to an empty SQLite database once", async () => {
  await withTempDatabase(async (database) => {
    const appliedFirst = await runMigrations(database);
    const tablesAfterFirstRun = await getTableNames(database);
    const rowsAfterFirstRun = await getLedgerRows(database);

    const appliedSecond = await runMigrations(database);
    const rowsAfterSecondRun = await getLedgerRows(database);

    assertEquals(appliedFirst, [
      "0001",
      "0002",
      "0003",
      "0004",
      "0005",
      "0006",
      "0007",
      "0008",
      "0009",
      "0010",
    ]);
    assertEquals(tablesAfterFirstRun, [
      "comment",
      "comment_document",
      "comment_reply",
      "document_instruction",
      "document_memory",
      "document_tag",
      "document_tag_link",
      "schema_migration",
      "sqlite_sequence",
    ]);
    assertEquals(rowsAfterFirstRun.length, 10);
    for (const row of rowsAfterFirstRun) {
      assertMatch(row.started_at, iso8601Pattern, row.version);
      assertExists(row.finished_at, row.version);
      assertMatch(row.finished_at, iso8601Pattern, row.version);
    }
    assertEquals(rowsAfterFirstRun[0]?.version, "0001");
    assertEquals(rowsAfterFirstRun[0]?.name, "create_comment_tables");
    assertEquals(rowsAfterFirstRun[0]?.state, "applied");
    assertExists(rowsAfterFirstRun[0]?.finished_at);
    assertEquals(rowsAfterFirstRun[0]?.error_message, null);
    assertEquals(rowsAfterFirstRun[1]?.version, "0002");
    assertEquals(rowsAfterFirstRun[1]?.name, "add_comment_authors");
    assertEquals(rowsAfterFirstRun[1]?.state, "applied");
    assertExists(rowsAfterFirstRun[1]?.finished_at);
    assertEquals(rowsAfterFirstRun[1]?.error_message, null);
    assertEquals(rowsAfterFirstRun[2]?.version, "0003");
    assertEquals(rowsAfterFirstRun[2]?.name, "add_comment_resolver");
    assertEquals(rowsAfterFirstRun[2]?.state, "applied");
    assertExists(rowsAfterFirstRun[2]?.finished_at);
    assertEquals(rowsAfterFirstRun[2]?.error_message, null);
    assertEquals(rowsAfterFirstRun[3]?.version, "0004");
    assertEquals(rowsAfterFirstRun[3]?.name, "add_reply_review_requested");
    assertEquals(rowsAfterFirstRun[3]?.state, "applied");
    assertExists(rowsAfterFirstRun[3]?.finished_at);
    assertEquals(rowsAfterFirstRun[3]?.error_message, null);
    assertEquals(rowsAfterFirstRun[4]?.version, "0005");
    assertEquals(rowsAfterFirstRun[4]?.name, "add_comment_document_snapshot");
    assertEquals(rowsAfterFirstRun[4]?.state, "applied");
    assertExists(rowsAfterFirstRun[4]?.finished_at);
    assertEquals(rowsAfterFirstRun[4]?.error_message, null);
    assertEquals(rowsAfterFirstRun[5]?.version, "0006");
    assertEquals(rowsAfterFirstRun[6]?.version, "0007");
    assertEquals(rowsAfterFirstRun[7]?.version, "0008");
    assertEquals(rowsAfterFirstRun[8]?.version, "0009");
    assertEquals(rowsAfterFirstRun[8]?.name, "create_document_memories");
    assertEquals(rowsAfterFirstRun[5]?.name, "create_document_instructions");
    assertEquals(rowsAfterFirstRun[5]?.state, "applied");
    assertExists(rowsAfterFirstRun[5]?.finished_at);
    assertEquals(rowsAfterFirstRun[5]?.error_message, null);
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

    const error = await assertRejects(
      () => runMigrations(database, [migration]),
      Error,
      "checksum mismatch",
    );
    for (
      const diagnostic of [
        "version=0001",
        "name=create_documents",
        "expected=sha256:stale",
        `actual=${await calculateMigrationChecksum(migration)}`,
        "add a new migration",
      ]
    ) {
      assertStringIncludes(error.message, diagnostic);
    }
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
    assertMatch(rows[0].started_at, iso8601Pattern);
    assertExists(rows[0].finished_at);
    assertMatch(rows[0].finished_at, iso8601Pattern);
    assertEquals(tables.includes("migration_body_should_rollback"), false);
  });
});

Deno.test("runMigrations rejects duplicate migration versions", async () => {
  await withTempDatabase(async (database) => {
    await assertRejects(
      () =>
        runMigrations(database, [
          createMigration("0001", "duplicate"),
          createMigration("0001", "duplicate_again"),
        ]),
      Error,
      "Duplicate database migration version: 0001",
    );
  });
});

Deno.test("runMigrations rejects non-zero-padded migration versions", async () => {
  await withTempDatabase(async (database) => {
    await assertRejects(
      () => runMigrations(database, [createMigration("1", "bad")]),
      Error,
      "Use four zero-padded digits such as 0001",
    );
  });
});

Deno.test("runMigrations rejects unsafe migration table names", async () => {
  await withTempDatabase(async (database) => {
    await assertRejects(
      () =>
        runMigrations(database, [], {
          tableName: "schema_migration; DROP TABLE comment",
        }),
      Error,
      "Invalid database identifier",
    );
  });
});

Deno.test("ensureMigrationLedger enforces SQLite ledger constraints", async () => {
  await withTempDatabase(async (database) => {
    await ensureMigrationLedger(database);
    const insert = (
      version: string,
      state: string,
      started: string,
      finished: string | null,
    ) =>
      database.execute(
        "INSERT INTO schema_migration (version, name, checksum, state, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)",
        [version, "example", "sha256:example", state, started, finished],
      );
    const timestamp = "2026-01-01T00:00:00.000Z";
    await insert("0001", "running", timestamp, null);
    assertEquals((await getLedgerRows(database))[0].finished_at, null);
    for (
      const [label, version, state, started, finished] of [
        ["duplicate version", "0001", "running", timestamp, null],
        ["invalid state", "0002", "unknown", timestamp, null],
        ["invalid start timestamp", "0002", "running", "yesterday", null],
        ["invalid finish timestamp", "0002", "applied", timestamp, "today"],
      ] as const
    ) {
      await assertRejects(
        () => insert(version, state, started, finished),
        Error,
        undefined,
        label,
      );
    }
  });
});

for (const partiallyApplied of [false, true]) {
  Deno.test(`runMigrations applies reversed migrations in order (${partiallyApplied ? "applied prefix" : "empty database"})`, async () => {
    await withTempDatabase(async (database) => {
      const first = createMigration("0001", "first", async (connection) => {
        await connection.execute(
          "CREATE TABLE migration_effects (sequence INTEGER PRIMARY KEY, version TEXT NOT NULL)",
        );
        await connection.execute(
          "INSERT INTO migration_effects (version) VALUES ('0001')",
        );
      });
      const second = createMigration("0002", "second", async (connection) => {
        await connection.execute(
          "INSERT INTO migration_effects (version) VALUES ('0002')",
        );
      });
      if (partiallyApplied) {
        assertEquals(await runMigrations(database, [first]), ["0001"]);
      }
      assertEquals(
        await runMigrations(database, [second, first]),
        partiallyApplied ? ["0002"] : ["0001", "0002"],
      );
      const effects = await database.execute<{ version: string }>(
        "SELECT version FROM migration_effects ORDER BY sequence",
      );
      assertEquals(effects.rows, [{ version: "0001" }, { version: "0002" }]);
    });
  });
}
