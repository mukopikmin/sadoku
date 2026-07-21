import type { AppDatabase } from "../connection.ts";
import type { Migration } from "../migrations.ts";

const addCommentAuthorsSql = [
  "ALTER TABLE comment ADD COLUMN author_type TEXT NOT NULL DEFAULT 'human' CHECK (author_type IN ('human', 'bot'))",
  "ALTER TABLE comment_reply ADD COLUMN author_type TEXT NOT NULL DEFAULT 'human' CHECK (author_type IN ('human', 'bot'))",
];

export const addCommentAuthorsMigration: Migration = {
  version: "0002",
  name: "add_comment_authors",
  checksumSource: addCommentAuthorsSql.join(";\n"),
  up: async (database: AppDatabase): Promise<void> => {
    for (const sql of addCommentAuthorsSql) await database.execute(sql);
  },
};
