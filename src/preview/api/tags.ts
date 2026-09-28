import type { DocumentTag } from "../models/document";
import { connectRawMessage, previewClient } from "./connect";

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
    !Number.isSafeInteger(Number(tag.id)) || typeof tag.name !== "string" ||
    !isTagBackgroundColor(tag.backgroundColor)
  ) throw new Error("Invalid tag response.");
  return {
    id: Number(tag.id),
    name: tag.name,
    backgroundColor: tag.backgroundColor.toLowerCase(),
  };
};

export const loadTags = async () => {
  const values: unknown[] = (await previewClient.listTags({}).catch((error) => {
    throw new Error(connectRawMessage(error));
  })).tags;
  return values.map((value) => {
    const tag = parseDocumentTag(value);
    const summary = value as Record<string, unknown>;
    if (
      !Number.isSafeInteger(Number(summary.documentCount)) ||
      typeof summary.createdAt !== "string" ||
      typeof summary.updatedAt !== "string"
    ) throw new Error("Invalid tag response.");
    return {
      ...tag,
      documentCount: Number(summary.documentCount),
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
  previewClient.updateTag({ id: BigInt(id), name, backgroundColor }).then(
    parseDocumentTag,
    (error) => {
      throw new Error(connectRawMessage(error));
    },
  );
export const replaceDocumentTags = async (
  documentId: number,
  tags: TagReference[],
) =>
  previewClient.replaceDocumentTags({
    documentId: BigInt(documentId),
    tags: tags.map((tag) =>
      "id" in tag
        ? { reference: { case: "id", value: BigInt(tag.id) } }
        : { reference: { case: "name", value: tag.name } }
    ),
  }).then(
    ({ tags }) => tags.map(parseDocumentTag),
    (error) => {
      throw new Error(connectRawMessage(error));
    },
  );
