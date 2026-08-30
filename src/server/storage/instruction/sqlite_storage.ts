import type { AppDatabase } from "../../db/connection.ts";
import type { InstructionStore } from "../../usecase/instruction/ports.ts";
import type { DocumentInstruction } from "../../usecase/instruction/types.ts";

type InstructionRow = {
  content: string;
  created_at: string;
  document_id: number;
  id: number;
  updated_at: string;
};

const fromRow = (row: InstructionRow): DocumentInstruction => ({
  content: row.content,
  createdAt: row.created_at,
  documentId: row.document_id,
  id: row.id,
  updatedAt: row.updated_at,
});

export const createSqliteInstructionStore = (
  database: AppDatabase,
): InstructionStore => ({
  create: async (documentId, content, now) => {
    await database.execute(
      "INSERT INTO document_instruction (document_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [documentId, content, now, now],
    );
    const inserted = (await database.execute<{ id: number }>(
      "SELECT last_insert_rowid() AS id",
    )).rows?.[0];
    const row = inserted && (await database.execute<InstructionRow>(
      "SELECT id, document_id, content, created_at, updated_at FROM document_instruction WHERE id = ?",
      [inserted.id],
    )).rows?.[0];
    if (!row) throw new Error("Instruction was not created.");
    return fromRow(row);
  },
  delete: async (documentId, instructionId) =>
    (await database.execute(
      "DELETE FROM document_instruction WHERE document_id = ? AND id = ?",
      [documentId, instructionId],
    )).rowsAffected! > 0,
  listByDocument: async (documentId) =>
    ((await database.execute<InstructionRow>(
      "SELECT id, document_id, content, created_at, updated_at FROM document_instruction WHERE document_id = ? ORDER BY id",
      [documentId],
    )).rows ?? []).map(fromRow),
  update: async (documentId, instructionId, content, now) => {
    const result = await database.execute(
      "UPDATE document_instruction SET content = ?, updated_at = ? WHERE document_id = ? AND id = ?",
      [content, now, documentId, instructionId],
    );
    if (result.rowsAffected === 0) return undefined;
    const row = (await database.execute<InstructionRow>(
      "SELECT id, document_id, content, created_at, updated_at FROM document_instruction WHERE id = ?",
      [instructionId],
    )).rows?.[0];
    return row && fromRow(row);
  },
});
