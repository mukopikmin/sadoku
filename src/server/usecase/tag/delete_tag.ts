import type { TagStore } from "./ports.ts";
import type { TagError } from "./types.ts";

export const deleteTag = async (store: TagStore, id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    return {
      type: "invalid",
      message: "Tag id must be a positive integer.",
    } satisfies TagError;
  }
  return await store.delete(id);
};
