import type { TagStore } from "./ports.ts";
import { prepareDocumentTagIds } from "./prepare_document_tag_ids.ts";

export const deleteDocumentTags = (
  store: Pick<TagStore, "deleteForDocument">,
  documentId: number,
  tagIds: readonly number[],
) => {
  const ids = prepareDocumentTagIds(documentId, tagIds);
  if (!Array.isArray(ids)) return Promise.resolve(ids);
  return store.deleteForDocument(documentId, ids);
};
