import type { TagStore } from "./ports.ts";
import {
  DEFAULT_TAG_BACKGROUND_COLOR,
  prepareTagBackgroundColor,
  prepareTagName,
} from "./types.ts";

export const addTag = async (
  store: Pick<TagStore, "create">,
  nameValue: unknown,
  backgroundColorValue: unknown = DEFAULT_TAG_BACKGROUND_COLOR,
) => {
  const name = prepareTagName(nameValue);
  if (typeof name !== "string") return name;
  const backgroundColor = prepareTagBackgroundColor(backgroundColorValue);
  if (typeof backgroundColor !== "string") return backgroundColor;
  return await store.create(name, backgroundColor);
};
