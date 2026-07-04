import type { AppDatabase } from "../connection.ts";
import type { Migration } from "../migrations.ts";

const sql = (strings: TemplateStringsArray): string =>
  strings.raw.join("").replace(/\s+/g, " ").trim();

const createCommentTablesSql = [
  sql`
    CREATE TABLE IF NOT EXISTS comment_documents (
      id INTEGER PRIMARY KEY,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'),
      updated_at TEXT NOT NULL CHECK (updated_at GLOB '????-??-??T??:??:??.???Z')
    )
  `,
  sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_documents_file_path
      ON comment_documents(file_path)
  `,
  sql`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY,
      document_id INTEGER NOT NULL,
      local_id INTEGER NOT NULL,
      line INTEGER NOT NULL,
      original_line INTEGER NOT NULL,
      body TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0, 1)),
      resolved_at TEXT CHECK (resolved_at IS NULL OR resolved_at GLOB '????-??-??T??:??:??.???Z'),
      source_hash TEXT,
      source_text TEXT,
      stale INTEGER NOT NULL DEFAULT 0 CHECK (stale IN (0, 1)),
      created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'),
      updated_at TEXT NOT NULL CHECK (updated_at GLOB '????-??-??T??:??:??.???Z'),
      FOREIGN KEY (document_id)
        REFERENCES comment_documents(id)
        ON DELETE CASCADE,
      UNIQUE (document_id, local_id)
    )
  `,
  sql`
    CREATE INDEX IF NOT EXISTS idx_comments_document_id
      ON comments(document_id)
  `,
  sql`
    CREATE INDEX IF NOT EXISTS idx_comments_document_line
      ON comments(document_id, line)
  `,
  sql`
    CREATE TABLE IF NOT EXISTS comment_replies (
      id INTEGER PRIMARY KEY,
      comment_id INTEGER NOT NULL,
      local_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'),
      updated_at TEXT NOT NULL CHECK (updated_at GLOB '????-??-??T??:??:??.???Z'),
      FOREIGN KEY (comment_id)
        REFERENCES comments(id)
        ON DELETE CASCADE,
      UNIQUE (comment_id, local_id)
    )
  `,
  sql`
    CREATE INDEX IF NOT EXISTS idx_comment_replies_comment_id
      ON comment_replies(comment_id)
  `,
];

export const createCommentTablesMigration: Migration = {
  version: "0001",
  name: "create_comment_tables",
  checksumSource: createCommentTablesSql.join(";\n"),
  up: async (database: AppDatabase): Promise<void> => {
    for (const sql of createCommentTablesSql) {
      await database.execute(sql);
    }
  },
};
