import { type AppDatabase, withTransaction } from "../db/connection.ts";
import type { DocumentStore } from "./storage.ts";
import type { Document } from "./types.ts";

type DocumentRow = {
  file_path: string;
  id: number;
};

const documentFromRow = (row: DocumentRow): Document => ({
  filePath: row.file_path,
  id: row.id,
});

export const createSqliteDocumentStore = (
  database: AppDatabase,
): DocumentStore => {
  const findById = async (id: number): Promise<Document | undefined> => {
    const row = (await database.execute<DocumentRow>(
      "SELECT id, file_path FROM comment_document WHERE id = ?",
      [id],
    )).rows?.[0];
    return row === undefined ? undefined : documentFromRow(row);
  };

  const findByFilePath = async (
    filePath: string,
  ): Promise<Document | undefined> => {
    const row = (await database.execute<DocumentRow>(
      "SELECT id, file_path FROM comment_document WHERE file_path = ?",
      [filePath],
    )).rows?.[0];
    return row === undefined ? undefined : documentFromRow(row);
  };

  const ensure = async (filePath: string): Promise<Document> => {
    const now = new Date().toISOString();
    await database.execute(
      `INSERT INTO comment_document (file_path, created_at, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(file_path) DO NOTHING`,
      [filePath, now, now],
    );
    const document = await findByFilePath(filePath);
    if (document === undefined) {
      throw new Error(`Document was not created for ${filePath}.`);
    }
    return document;
  };

  return {
    ensure,
    ensureMany: (filePaths) =>
      withTransaction(database, async () => {
        const documents: Document[] = [];
        for (const filePath of filePaths) {
          documents.push(await ensure(filePath));
        }
        return documents;
      }),
    findByFilePath,
    findById,
  };
};
