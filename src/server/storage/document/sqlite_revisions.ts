import type { AppDatabase } from "../../db/connection.ts";

type SnapshotRow = {
  source_revision_id: number | null;
  previous_source_revision_id: number | null;
  source_snapshot: string | null;
  previous_source_snapshot: string | null;
};

export const readDocumentSnapshots = async (
  database: AppDatabase,
  documentId: number,
): Promise<SnapshotRow | undefined> =>
  (await database.execute<SnapshotRow>(
    `SELECT d.source_revision_id, d.previous_source_revision_id,
      current.markdown AS source_snapshot, previous.markdown AS previous_source_snapshot
      FROM comment_document d
      LEFT JOIN document_revision current ON current.id = d.source_revision_id
      LEFT JOIN document_revision previous ON previous.id = d.previous_source_revision_id
      WHERE d.id = ?`,
    [documentId],
  )).rows?.[0];

/** The caller must insert the revision and update its pointers in one transaction. */
export const appendDocumentRevision = async (
  database: AppDatabase,
  documentId: number,
  markdown: string,
): Promise<number> => {
  await database.execute(
    "INSERT INTO document_revision (document_id, markdown) VALUES (?, ?)",
    [documentId, markdown],
  );
  const row = (await database.execute<{ id: number }>(
    "SELECT id FROM document_revision WHERE document_id = ? ORDER BY id DESC LIMIT 1",
    [documentId],
  )).rows?.[0];
  if (!row) throw new Error("Document revision was not created.");
  return row.id;
};

/** Preserve the snapshot contract while retaining every superseded revision. */
export const writeDocumentSnapshots = async (
  database: AppDatabase,
  documentId: number,
  snapshots: { sourceSnapshot?: string; previousSourceSnapshot?: string },
): Promise<void> => {
  const stored = await readDocumentSnapshots(database, documentId);
  const previous = snapshots.previousSourceSnapshot;
  const previousId = previous === undefined
    ? null
    : previous === stored?.source_snapshot
    ? stored.source_revision_id
    : previous === stored?.previous_source_snapshot
    ? stored.previous_source_revision_id
    : await appendDocumentRevision(database, documentId, previous);
  const current = snapshots.sourceSnapshot;
  const currentId = current === undefined
    ? null
    : current === stored?.source_snapshot
    ? stored.source_revision_id
    : current === previous
    ? previousId
    : await appendDocumentRevision(database, documentId, current);
  await database.execute(
    `UPDATE comment_document SET source_revision_id = ?, previous_source_revision_id = ?
      WHERE id = ?`,
    [currentId, previousId, documentId],
  );
};
