import type { TagStore } from "./ports.ts";
import { prepareTagName, type TagError } from "./types.ts";

export const renameTag = async (
  store: TagStore,
  id: number,
  value: unknown,
) => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    return {
      type: "invalid",
      message: "Tag id must be a positive integer.",
    } satisfies TagError;
  }
  const name = prepareTagName(value);
  return typeof name === "string" ? await store.rename(id, name) : name;
};
