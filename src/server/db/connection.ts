export interface DbStatementResult<Row = Record<string, unknown>> {
  rows?: Row[];
  rowsAffected?: number;
}

export interface DbConnection {
  execute<Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<DbStatementResult<Row>>;
}

export async function withTransaction<T>(
  connection: DbConnection,
  operation: () => Promise<T>,
): Promise<T> {
  await connection.execute("BEGIN");
  try {
    const result = await operation();
    await connection.execute("COMMIT");
    return result;
  } catch (error) {
    await connection.execute("ROLLBACK");
    throw error;
  }
}
