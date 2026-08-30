import type { DocumentTag } from "../models/document";

export type TagSummary = DocumentTag & {
  documentCount: number;
  createdAt: string;
  updatedAt: string;
};
export type TagReference = { id: number } | { name: string };

const result = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(
      (await response.text()) || `Tag request failed: ${response.status}`,
    );
  }
  return await response.json() as T;
};
export const loadTags = async () =>
  result<TagSummary[]>(await fetch("/__sadoku/tags"));
export const replaceDocumentTags = async (
  documentId: number,
  tags: TagReference[],
) =>
  result<DocumentTag[]>(
    await fetch(`/__sadoku/documents/${documentId}/tags`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tags }),
    }),
  );
export const renameTag = async (id: number, name: string, updatedAt?: string) =>
  result<TagSummary>(
    await fetch(`/__sadoku/tags/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, updatedAt }),
    }),
  );
