import type { DocumentStore } from "./ports.ts";

export const listDocuments = (documentStore: DocumentStore) =>
  documentStore.list();
