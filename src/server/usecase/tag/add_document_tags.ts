import type { TagStore } from "./ports.ts";
import { prepareDocumentTagIds } from "./prepare_document_tag_ids.ts";
import { MAX_DOCUMENT_TAGS } from "./types.ts";

export const addDocumentTags = (
  store: Pick<TagStore, "addForDocument">,
  documentId: number,
  tagIds: readonly number[],
) => {
  const ids = prepareDocumentTagIds(documentId, tagIds);
  if (!Array.isArray(ids)) return Promise.resolve(ids);
  return store.addForDocument(documentId, ids, MAX_DOCUMENT_TAGS);
};
