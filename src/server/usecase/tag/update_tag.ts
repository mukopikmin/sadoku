import type { TagStore } from "./ports.ts";
import {
  prepareTagBackgroundColor,
  prepareTagName,
  type TagError,
} from "./types.ts";

export const updateTag = async (
  store: TagStore,
  id: number,
  nameValue: unknown,
  backgroundColorValue: unknown,
) => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    return {
      type: "invalid",
      message: "Tag id must be a positive integer.",
    } satisfies TagError;
  }
  if (nameValue === undefined && backgroundColorValue === undefined) {
    return {
      type: "invalid",
      message: "Tag name or background color is required.",
    } satisfies TagError;
  }
  const name = nameValue === undefined ? undefined : prepareTagName(nameValue);
  if (name !== undefined && typeof name !== "string") return name;
  const backgroundColor = backgroundColorValue === undefined
    ? undefined
    : prepareTagBackgroundColor(backgroundColorValue);
  if (backgroundColor !== undefined && typeof backgroundColor !== "string") {
    return backgroundColor;
  }
  return await store.update(id, name, backgroundColor);
};
