import type { Migration } from "../migrations.ts";

export const createDocumentTagsMigration: Migration = {
  version: "0007",
  name: "create_document_tags",
  checksumSource:
    `CREATE TABLE document_tag (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'), updated_at TEXT NOT NULL CHECK (updated_at GLOB '????-??-??T??:??:??.???Z')); CREATE TABLE document_tag_link (document_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (document_id, tag_id));`,
  up: async (database) => {
    await database.execute(`CREATE TABLE document_tag (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'),
      updated_at TEXT NOT NULL CHECK (updated_at GLOB '????-??-??T??:??:??.???Z')
    )`);
    await database.execute(`CREATE TABLE document_tag_link (
      document_id INTEGER NOT NULL REFERENCES comment_document(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES document_tag(id) ON DELETE CASCADE,
      UNIQUE(document_id, tag_id)
    )`);
  },
};
