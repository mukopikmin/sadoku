import type { DocumentTag } from "../models/document";

export type TagSummary = DocumentTag & {
  documentCount: number;
  createdAt: string;
  updatedAt: string;
};
export type TagReference = { id: number } | { name: string };

export const isTagBackgroundColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

export const parseDocumentTag = (value: unknown): DocumentTag => {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid tag response.");
  }
  const tag = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(tag.id) || typeof tag.name !== "string" ||
    !isTagBackgroundColor(tag.backgroundColor)
  ) throw new Error("Invalid tag response.");
  return {
    id: Number(tag.id),
    name: tag.name,
    backgroundColor: tag.backgroundColor.toLowerCase(),
  };
};

const result = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(
      (await response.text()) || `Tag request failed: ${response.status}`,
    );
  }
  return await response.json() as T;
};
export const loadTags = async () => {
  const values = await result<unknown[]>(await fetch("/__sadoku/tags"));
  return values.map((value) => {
    const tag = parseDocumentTag(value);
    const summary = value as Record<string, unknown>;
    if (
      typeof summary.documentCount !== "number" ||
      typeof summary.createdAt !== "string" ||
      typeof summary.updatedAt !== "string"
    ) throw new Error("Invalid tag response.");
    return {
      ...tag,
      documentCount: summary.documentCount,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    };
  });
};
export const updateTag = async (
  id: number,
  name: string,
  backgroundColor: string,
) =>
  result<unknown>(
    await fetch(`/__sadoku/tags/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, backgroundColor }),
    }),
  ).then(parseDocumentTag);
export const replaceDocumentTags = async (
  documentId: number,
  tags: TagReference[],
) =>
  result<unknown[]>(
    await fetch(`/__sadoku/documents/${documentId}/tags`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tags }),
    }),
  ).then((values) => values.map(parseDocumentTag));
