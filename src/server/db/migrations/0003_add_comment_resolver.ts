import type { AppDatabase } from "../connection.ts";
import type { Migration } from "../migrations.ts";

const addCommentResolverSql =
  "ALTER TABLE comment ADD COLUMN resolved_by_type TEXT CHECK (resolved_by_type IN ('human', 'bot'))";

export const addCommentResolverMigration: Migration = {
  version: "0003",
  name: "add_comment_resolver",
  checksumSource: addCommentResolverSql,
  up: async (database: AppDatabase): Promise<void> => {
    await database.execute(addCommentResolverSql);
  },
};
