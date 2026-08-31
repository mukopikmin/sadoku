import type { TagStore } from "./ports.ts";
import { prepareTagName, type TagError, type TagReference } from "./types.ts";

export const replaceDocumentTags = async (
  store: TagStore,
  documentId: number,
  values: unknown,
) => {
  if (!Array.isArray(values)) {
    return {
      type: "invalid",
      message: "Tags must be an array.",
    } satisfies TagError;
  }
  if (values.length > 20) {
    return {
      type: "invalid",
      message: "A document can have at most 20 tags.",
    } satisfies TagError;
  }
  const references: TagReference[] = [];
  for (const value of values) {
    if (!value || typeof value !== "object") {
      return {
        type: "invalid",
        message: "Each tag must contain an id or name.",
      } satisfies TagError;
    }
    const item = value as Record<string, unknown>;
    if (
      Number.isSafeInteger(item.id) && Number(item.id) > 0 &&
      item.name === undefined
    ) references.push({ id: Number(item.id) });
    else if (item.id === undefined) {
      const name = prepareTagName(item.name);
      if (typeof name !== "string") return name;
      references.push({ name });
    } else {return {
        type: "invalid",
        message: "Each tag must contain either an id or name.",
      } satisfies TagError;}
  }
  return await store.replaceForDocument(documentId, references);
};
