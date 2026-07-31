import type { AppDatabase } from "../connection.ts";
import type { Migration } from "../migrations.ts";

const addCommentDocumentSnapshotSql = [
  "ALTER TABLE comment_document ADD COLUMN source_snapshot TEXT",
  "ALTER TABLE comment_document ADD COLUMN previous_source_snapshot TEXT",
];

export const addCommentDocumentSnapshotMigration: Migration = {
  version: "0005",
  name: "add_comment_document_snapshot",
  checksumSource: addCommentDocumentSnapshotSql.join(";\n"),
  up: async (database: AppDatabase): Promise<void> => {
    for (const sql of addCommentDocumentSnapshotSql) {
      await database.execute(sql);
    }
  },
};
