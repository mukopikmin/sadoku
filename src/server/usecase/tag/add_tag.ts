import type { TagStore } from "./ports.ts";
import { DEFAULT_TAG_BACKGROUND_COLOR, prepareTagName } from "./types.ts";

export const addTag = async (
  store: Pick<TagStore, "create">,
  nameValue: unknown,
) => {
  const name = prepareTagName(nameValue);
  if (typeof name !== "string") return name;
  return await store.create(name, DEFAULT_TAG_BACKGROUND_COLOR);
};
