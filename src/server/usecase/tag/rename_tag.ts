import type { TagStore } from "./ports.ts";
import { prepareTagName } from "./types.ts";

export const renameTag = async (
  store: TagStore,
  id: number,
  value: unknown,
  expectedUpdatedAt?: unknown,
) => {
  const name = prepareTagName(value);
  if (typeof name !== "string") return name;
  if (
    expectedUpdatedAt !== undefined && typeof expectedUpdatedAt !== "string"
  ) {
    return {
      type: "invalid" as const,
      message: "updatedAt must be a string.",
    };
  }
  return await store.rename(id, name, expectedUpdatedAt as string | undefined);
};
