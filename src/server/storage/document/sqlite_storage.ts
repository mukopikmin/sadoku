import { type AppDatabase, withTransaction } from "../../db/connection.ts";
import type { DocumentStore } from "../../usecase/document/ports.ts";
import type { Document } from "../../usecase/document/types.ts";
import { appendDocumentRevision } from "./sqlite_revisions.ts";

type DocumentRow = {
  file_path: string;
  title: string | null;
  id: number;
};

type SnapshotRow = { source_snapshot: string | null };

const documentFromRow = (row: DocumentRow): Document => ({
  filePath: row.file_path,
  id: row.id,
  ...(row.title !== null && { displayTitle: row.title }),
});

export const createSqliteDocumentStore = (
  database: AppDatabase,
): DocumentStore => {
  const findById = async (id: number): Promise<Document | undefined> => {
    const row = (await database.execute<DocumentRow>(
      "SELECT id, file_path, title FROM comment_document WHERE id = ?",
      [id],
    )).rows?.[0];
    return row === undefined ? undefined : documentFromRow(row);
  };

  const findByFilePath = async (
    filePath: string,
  ): Promise<Document | undefined> => {
    const row = (await database.execute<DocumentRow>(
      "SELECT id, file_path, title FROM comment_document WHERE file_path = ?",
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

  const needsSnapshot = async (id: number): Promise<boolean> =>
    (await database.execute<{ source_revision_id: number | null }>(
      "SELECT source_revision_id FROM comment_document WHERE id = ?",
      [id],
    )).rows?.[0]?.source_revision_id === null;

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
    list: async () => {
      const result = await database.execute<DocumentRow>(
        "SELECT id, file_path, title FROM comment_document ORDER BY id",
      );
      return (result.rows ?? []).map(documentFromRow);
    },
    setTitle: async (id, title) => {
      await database.execute(
        "UPDATE comment_document SET title = ?, updated_at = ? WHERE id = ?",
        [title ?? null, new Date().toISOString(), id],
      );
    },
    listRevisions: async (documentId, limit) =>
      (await database.execute<{ id: number; recorded_at: string }>(
        `SELECT id, recorded_at FROM document_revision
          WHERE document_id = ? ORDER BY id DESC LIMIT ?`,
        [documentId, limit],
      )).rows?.map((row) => ({ id: row.id, recordedAt: row.recorded_at })) ??
        [],
    findRevision: async (documentId, revisionId) => {
      const row = (await database.execute<
        {
          id: number;
          recorded_at: string;
          markdown: string;
          previous_markdown: string | null;
        }
      >(
        `SELECT r.id, r.recorded_at, r.markdown,
          (SELECT p.markdown FROM document_revision p
            WHERE p.document_id = r.document_id AND p.id < r.id
            ORDER BY p.id DESC LIMIT 1) AS previous_markdown
          FROM document_revision r WHERE r.document_id = ? AND r.id = ?`,
        [documentId, revisionId],
      )).rows?.[0];
      return row &&
        {
          id: row.id,
          recordedAt: row.recorded_at,
          markdown: row.markdown,
          previousMarkdown: row.previous_markdown ?? undefined,
        };
    },
    readSnapshot: async (id) => {
      const row = (await database.execute<SnapshotRow>(
        `SELECT r.markdown AS source_snapshot FROM comment_document d
          JOIN document_revision r ON r.id = d.source_revision_id WHERE d.id = ?`,
        [id],
      )).rows?.[0];
      return row?.source_snapshot ?? undefined;
    },
    initializeSnapshot: async (id, markdown) => {
      if (!await needsSnapshot(id)) return;
      await withTransaction(database, async () => {
        // Another request may have initialized the snapshot while we waited.
        if (!await needsSnapshot(id)) return;
        const revisionId = await appendDocumentRevision(database, id, markdown);
        await database.execute(
          "UPDATE comment_document SET source_revision_id = ? WHERE id = ?",
          [revisionId, id],
        );
      });
    },
  };
};
