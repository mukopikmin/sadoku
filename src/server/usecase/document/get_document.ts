import type { DocumentStore } from "./ports.ts";

export const getDocument = async (documentStore: DocumentStore, id: number) => {
  const document = await documentStore.findById(id);
  if (!document) throw new Error(`Document not found: ${id}`);
  return document;
};
