import type { TagError } from "./types.ts";

export const prepareDocumentTagIds = (
  documentId: number,
  tagIds: readonly number[],
): number[] | TagError => {
  if (!Number.isSafeInteger(documentId) || documentId <= 0) {
    return {
      type: "invalid",
      message: "Document id must be a positive integer.",
    };
  }
  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    return { type: "invalid", message: "At least one tag id is required." };
  }
  if (tagIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return { type: "invalid", message: "Tag ids must be positive integers." };
  }
  return [...new Set(tagIds)];
};
