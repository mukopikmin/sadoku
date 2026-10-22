import { addTag as addTagUseCase } from "../usecase/tag/add_tag.ts";
import { deleteTag as deleteTagUseCase } from "../usecase/tag/delete_tag.ts";
import { listTags as listTagsUseCase } from "../usecase/tag/list_tags.ts";
import type { TagStore } from "../usecase/tag/ports.ts";
import type { TagError } from "../usecase/tag/types.ts";

const mapUseCaseError = (error: TagError): never => {
  switch (error.type) {
    case "invalid":
    case "not_found":
    case "conflict":
      throw new Error(error.message);
  }
};

export const addTag = async (
  name: string,
  backgroundColor: string | undefined,
  store: TagStore,
) => {
  const result = await addTagUseCase(store, name, backgroundColor);
  if ("type" in result) return mapUseCaseError(result);
  return result;
};

export const listTags = (store: TagStore) => listTagsUseCase(store);

export const deleteTag = async (id: number, store: TagStore): Promise<void> => {
  const error = await deleteTagUseCase(store, id);
  if (error) mapUseCaseError(error);
};
