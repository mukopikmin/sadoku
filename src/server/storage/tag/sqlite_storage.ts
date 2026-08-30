import { type AppDatabase, withTransaction } from "../../db/connection.ts";
import type { TagStore } from "../../usecase/tag/ports.ts";
import type { Tag, TagError, TagSummary } from "../../usecase/tag/types.ts";

type TagRow = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  document_count?: number;
};
const tag = (row: TagRow): Tag => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const summary = (row: TagRow): TagSummary => ({
  ...tag(row),
  documentCount: row.document_count ?? 0,
});

export const createSqliteTagStore = (database: AppDatabase): TagStore => {
  const findById = async (id: number) =>
    (await database.execute<TagRow>(
      "SELECT id, name, created_at, updated_at FROM document_tag WHERE id = ?",
      [id],
    )).rows?.[0];
  const findByName = async (name: string) =>
    (await database.execute<TagRow>(
      "SELECT id, name, created_at, updated_at FROM document_tag WHERE name = ?",
      [name],
    )).rows?.[0];
  const listForDocument = async (documentId: number) =>
    ((await database.execute<TagRow>(
      `SELECT t.id, t.name, t.created_at, t.updated_at FROM document_tag t
     JOIN document_tag_link l ON l.tag_id = t.id WHERE l.document_id = ? ORDER BY t.name`,
      [documentId],
    )).rows ?? []).map(tag);

  return {
    list: async () =>
      ((await database.execute<TagRow>(
        `SELECT t.id, t.name, t.created_at, t.updated_at, COUNT(l.document_id) document_count
       FROM document_tag t LEFT JOIN document_tag_link l ON l.tag_id = t.id
       GROUP BY t.id ORDER BY t.name`,
      )).rows ?? []).map(summary),
    listForDocument,
    replaceForDocument: (documentId, references) =>
      withTransaction(database, async () => {
        const document = (await database.execute<{ id: number }>(
          "SELECT id FROM comment_document WHERE id = ?",
          [documentId],
        )).rows?.[0];
        if (!document) {
          return {
            type: "not_found",
            message: "Document not found.",
          } satisfies TagError;
        }
        const ids: number[] = [];
        for (const reference of references) {
          if ("id" in reference) {
            if (!await findById(reference.id)) {
              return {
                type: "not_found",
                message: `Tag ${reference.id} not found.`,
              } satisfies TagError;
            }
            ids.push(reference.id);
          } else {
            let row = await findByName(reference.name);
            if (!row) {
              const now = new Date().toISOString();
              try {
                await database.execute(
                  "INSERT INTO document_tag (name, created_at, updated_at) VALUES (?, ?, ?)",
                  [reference.name, now, now],
                );
              } catch (error) {
                row = await findByName(reference.name);
                if (!row) throw error;
              }
              row ??= await findByName(reference.name);
            }
            ids.push(row!.id);
          }
        }
        if (new Set(ids).size !== ids.length) {
          return {
            type: "conflict",
            message: "Tag is already added.",
          } satisfies TagError;
        }
        await database.execute(
          "DELETE FROM document_tag_link WHERE document_id = ?",
          [documentId],
        );
        for (const id of ids) {
          await database.execute(
            "INSERT INTO document_tag_link (document_id, tag_id) VALUES (?, ?)",
            [documentId, id],
          );
        }
        return await listForDocument(documentId);
      }),
    rename: (id, name, expectedUpdatedAt) =>
      withTransaction(database, async () => {
        const current = await findById(id);
        if (!current) {
          return {
            type: "not_found",
            message: "Tag not found.",
          } satisfies TagError;
        }
        if (
          expectedUpdatedAt !== undefined &&
          current.updated_at !== expectedUpdatedAt
        ) {
          return {
            type: "conflict",
            message: "Tag was modified by another request.",
          } satisfies TagError;
        }
        const duplicate = await findByName(name);
        if (duplicate && duplicate.id !== id) {
          return {
            type: "conflict",
            message: "A tag with that name already exists.",
          } satisfies TagError;
        }
        const now = new Date().toISOString();
        await database.execute(
          "UPDATE document_tag SET name = ?, updated_at = ? WHERE id = ?",
          [name, now, id],
        );
        const count = (await database.execute<{ count: number }>(
          "SELECT COUNT(*) count FROM document_tag_link WHERE tag_id = ?",
          [id],
        )).rows?.[0]?.count ?? 0;
        return { ...tag((await findById(id))!), documentCount: count };
      }),
  };
};
