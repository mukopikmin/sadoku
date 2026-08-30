import type { AppDatabase } from "../connection.ts";
import type { Migration } from "../migrations.ts";

const sql = (strings: TemplateStringsArray): string =>
  strings.raw.join("").replace(/\s+/g, " ").trim();

const statements = [
  sql`
    CREATE TABLE document_instruction (
      id INTEGER PRIMARY KEY,
      document_id INTEGER NOT NULL,
      content TEXT NOT NULL CHECK (length(trim(content)) > 0),
      created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'),
      updated_at TEXT NOT NULL CHECK (updated_at GLOB '????-??-??T??:??:??.???Z'),
      FOREIGN KEY (document_id) REFERENCES comment_document(id) ON DELETE CASCADE
    )
  `,
  sql`
    CREATE INDEX idx_document_instruction_document_id
      ON document_instruction(document_id)
  `,
];

export const createDocumentInstructionsMigration: Migration = {
  version: "0006",
  name: "create_document_instructions",
  checksumSource: statements.join(";\n"),
  up: async (database: AppDatabase): Promise<void> => {
    for (const statement of statements) await database.execute(statement);
  },
};
