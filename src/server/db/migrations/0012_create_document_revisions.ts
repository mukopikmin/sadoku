import type { Migration } from "../migrations.ts";

const statements = [
  `CREATE TABLE document_revision (
    id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES comment_document(id) ON DELETE CASCADE,
    markdown TEXT NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      CHECK (recorded_at GLOB '????-??-??T??:??:??.???Z')
  )`,
  "CREATE INDEX idx_document_revision_document_id ON document_revision(document_id, id)",
  "ALTER TABLE comment_document ADD COLUMN source_revision_id INTEGER REFERENCES document_revision(id)",
  "ALTER TABLE comment_document ADD COLUMN previous_source_revision_id INTEGER REFERENCES document_revision(id)",
  // Record migration time, since the original revision timestamps are unknown.
  `INSERT INTO document_revision (document_id, markdown)
    SELECT id, previous_source_snapshot FROM comment_document
    WHERE previous_source_snapshot IS NOT NULL ORDER BY id`,
  `UPDATE comment_document SET previous_source_revision_id = (
    SELECT id FROM document_revision WHERE document_id = comment_document.id
    ORDER BY id DESC LIMIT 1
  )`,
  `INSERT INTO document_revision (document_id, markdown)
    SELECT id, source_snapshot FROM comment_document
    WHERE source_snapshot IS NOT NULL
      AND (previous_source_snapshot IS NULL OR source_snapshot <> previous_source_snapshot)
    ORDER BY id`,
  `UPDATE comment_document SET source_revision_id = (
    SELECT id FROM document_revision WHERE document_id = comment_document.id
    ORDER BY id DESC LIMIT 1
  ) WHERE source_snapshot IS NOT NULL`,
  "ALTER TABLE comment_document DROP COLUMN previous_source_snapshot",
  "ALTER TABLE comment_document DROP COLUMN source_snapshot",
];

export const createDocumentRevisionsMigration: Migration = {
  version: "0012",
  name: "create_document_revisions",
  checksumSource: statements.join(";\n"),
  up: async (database) => {
    for (const statement of statements) await database.execute(statement);
  },
};
