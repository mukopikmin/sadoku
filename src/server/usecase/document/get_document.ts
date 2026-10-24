import type { DocumentStore, DocumentTagReader } from "./ports.ts";
import { listDocumentTags } from "./list_document_tags.ts";

export const getDocument = async (
  documentStore: DocumentStore,
  id: number,
  tagReader?: DocumentTagReader,
) => {
  const document = await documentStore.findById(id);
  if (!document) throw new Error(`Document not found: ${id}`);
  return { ...document, tags: await listDocumentTags(id, tagReader) ?? [] };
};
