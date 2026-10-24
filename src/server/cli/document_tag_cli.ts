import { addDocumentTags as addDocumentTagsUseCase } from "../usecase/tag/add_document_tags.ts";
import { deleteDocumentTags as deleteDocumentTagsUseCase } from "../usecase/tag/delete_document_tags.ts";
import type { TagStore } from "../usecase/tag/ports.ts";
import type { Tag, TagError } from "../usecase/tag/types.ts";

const publicTags = (result: Tag[] | TagError) => {
  if (!Array.isArray(result)) {
    switch (result.type) {
      case "invalid":
      case "not_found":
      case "conflict":
        throw new Error(result.message);
    }
  }
  return result.map(({ id, name, backgroundColor }) => ({
    id,
    name,
    backgroundColor,
  }));
};

export const addDocumentTags = async (
  documentId: number,
  tagIds: readonly number[],
  store: Pick<TagStore, "addForDocument">,
) => publicTags(await addDocumentTagsUseCase(store, documentId, tagIds));

export const deleteDocumentTags = async (
  documentId: number,
  tagIds: readonly number[],
  store: Pick<TagStore, "deleteForDocument">,
) => publicTags(await deleteDocumentTagsUseCase(store, documentId, tagIds));
