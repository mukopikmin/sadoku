import type { DocumentStore, DocumentTagReader } from "./ports.ts";
import { listDocumentTags } from "./list_document_tags.ts";

export const listDocuments = async (
  documentStore: DocumentStore,
  tagReader?: DocumentTagReader,
) =>
  Promise.all((await documentStore.list()).map(async (document) => ({
    ...document,
    tags: await listDocumentTags(document.id, tagReader) ?? [],
  })));
