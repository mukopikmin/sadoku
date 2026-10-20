import type { Migration } from "../migrations.ts";

const statement =
  "ALTER TABLE comment ADD COLUMN source_deleted INTEGER NOT NULL DEFAULT 0 CHECK (source_deleted IN (0, 1))";

export const addCommentSourceDeletedMigration: Migration = {
  version: "0011",
  name: "add_comment_source_deleted",
  checksumSource: statement,
  up: async (database) => {
    await database.execute(statement);
  },
};
