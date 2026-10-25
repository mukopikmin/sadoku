import type { DocumentStore } from "./ports.ts";
import type { Document } from "./types.ts";

export const updateDocumentTitle = async <T extends Document>(
  document: T,
  title: string,
  store: DocumentStore,
): Promise<T> => {
  if (/[\r\n\u0000]/.test(title)) {
    throw { type: "invalid_document_title" } as const;
  }
  if (!store.setTitle) throw { type: "title_storage_unavailable" } as const;
  const normalized = title.trim() || undefined;
  await store.setTitle(document.id, normalized);
  document.displayTitle = normalized;
  return document;
};
