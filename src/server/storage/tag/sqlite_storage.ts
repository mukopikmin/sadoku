import { type AppDatabase, withTransaction } from "../../db/connection.ts";
import type { TagStore } from "../../usecase/tag/ports.ts";
import {
  DEFAULT_TAG_BACKGROUND_COLOR,
  type Tag,
  type TagError,
  type TagSummary,
} from "../../usecase/tag/types.ts";

type TagRow = {
  id: number;
  name: string;
  background_color: string;
  created_at: string;
  updated_at: string;
  document_count?: number;
};
const tag = (row: TagRow): Tag => ({
  id: row.id,
  name: row.name,
  backgroundColor: row.background_color,
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
      "SELECT id, name, background_color, created_at, updated_at FROM document_tag WHERE id = ?",
      [id],
    )).rows?.[0];
  const findByName = async (name: string) =>
    (await database.execute<TagRow>(
      "SELECT id, name, background_color, created_at, updated_at FROM document_tag WHERE name = ?",
      [name],
    )).rows?.[0];
  const listForDocument = async (documentId: number) =>
    ((await database.execute<TagRow>(
      `SELECT t.id, t.name, t.background_color, t.created_at, t.updated_at FROM document_tag t
     JOIN document_tag_link l ON l.tag_id = t.id WHERE l.document_id = ? ORDER BY t.name`,
      [documentId],
    )).rows ?? []).map(tag);

  const updateValues = (
    id: number,
    name?: string,
    backgroundColor?: string,
  ) =>
    withTransaction(database, async () => {
      const existing = await findById(id);
      if (!existing) {
        return {
          type: "not_found",
          message: `Tag ${id} not found.`,
        } satisfies TagError;
      }
      const nextName = name ?? existing.name;
      const duplicate = await findByName(nextName);
      if (duplicate && duplicate.id !== id) {
        return {
          type: "conflict",
          message: "Tag name already exists.",
        } satisfies TagError;
      }
      const color = backgroundColor ?? existing.background_color;
      if (existing.name !== nextName || existing.background_color !== color) {
        await database.execute(
          "UPDATE document_tag SET name = ?, background_color = ?, updated_at = ? WHERE id = ?",
          [nextName, color, new Date().toISOString(), id],
        );
      }
      return tag((await findById(id))!);
    });

  return {
    list: async () =>
      ((await database.execute<TagRow>(
        `SELECT t.id, t.name, t.background_color, t.created_at, t.updated_at, COUNT(l.document_id) document_count
       FROM document_tag t LEFT JOIN document_tag_link l ON l.tag_id = t.id
       GROUP BY t.id ORDER BY t.name`,
      )).rows ?? []).map(summary),
    listForDocument,
    rename: (id, name) => updateValues(id, name),
    update: (id, name, backgroundColor) =>
      updateValues(id, name, backgroundColor),
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
                  "INSERT INTO document_tag (name, background_color, created_at, updated_at) VALUES (?, ?, ?, ?)",
                  [reference.name, DEFAULT_TAG_BACKGROUND_COLOR, now, now],
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
  };
};
