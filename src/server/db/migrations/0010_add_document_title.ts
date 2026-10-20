import type { Migration } from "../migrations.ts";

const sql = "ALTER TABLE comment_document ADD COLUMN title TEXT";

export const addDocumentTitleMigration: Migration = {
  version: "0010",
  name: "add_document_title",
  checksumSource: sql,
  up: async (database) => {
    await database.execute(sql);
  },
};
