import type { AppDatabase } from "../connection.ts";
import type { Migration } from "../migrations.ts";

const addReplyReviewRequestedSql =
  "ALTER TABLE comment_reply ADD COLUMN review_requested INTEGER NOT NULL DEFAULT 0 CHECK (review_requested IN (0, 1))";

export const addReplyReviewRequestedMigration: Migration = {
  version: "0004",
  name: "add_reply_review_requested",
  checksumSource: addReplyReviewRequestedSql,
  up: async (database: AppDatabase): Promise<void> => {
    await database.execute(addReplyReviewRequestedSql);
  },
};
