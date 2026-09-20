import type { AppDatabase } from "../../db/connection.ts";
import type { MemoryStore } from "../../usecase/memory/ports.ts";
import type { DocumentMemory } from "../../usecase/memory/types.ts";

type MemoryRow = {
  content: string;
  created_at: string;
  document_id: number;
  id: number;
  updated_at: string;
};

const fromRow = (row: MemoryRow): DocumentMemory => ({
  content: row.content,
  createdAt: row.created_at,
  documentId: row.document_id,
  id: row.id,
  updatedAt: row.updated_at,
});

export const createSqliteMemoryStore = (
  database: AppDatabase,
): MemoryStore => ({
  create: async (documentId, content, now) => {
    await database.execute(
      "INSERT INTO document_memory (document_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [documentId, content, now, now],
    );
    const inserted = (await database.execute<{ id: number }>(
      "SELECT last_insert_rowid() AS id",
    )).rows?.[0];
    const row = inserted && (await database.execute<MemoryRow>(
      "SELECT id, document_id, content, created_at, updated_at FROM document_memory WHERE id = ?",
      [inserted.id],
    )).rows?.[0];
    if (!row) throw new Error("Memory was not created.");
    return fromRow(row);
  },
  delete: async (documentId, memoryId) =>
    (await database.execute(
      "DELETE FROM document_memory WHERE document_id = ? AND id = ?",
      [documentId, memoryId],
    )).rowsAffected! > 0,
  listByDocument: async (documentId) =>
    ((await database.execute<MemoryRow>(
      "SELECT id, document_id, content, created_at, updated_at FROM document_memory WHERE document_id = ? ORDER BY id",
      [documentId],
    )).rows ?? []).map(fromRow),
  update: async (documentId, memoryId, content, now) => {
    const result = await database.execute(
      "UPDATE document_memory SET content = ?, updated_at = ? WHERE document_id = ? AND id = ?",
      [content, now, documentId, memoryId],
    );
    if (result.rowsAffected === 0) return undefined;
    const row = (await database.execute<MemoryRow>(
      "SELECT id, document_id, content, created_at, updated_at FROM document_memory WHERE id = ?",
      [memoryId],
    )).rows?.[0];
    return row && fromRow(row);
  },
});
