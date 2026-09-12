import type { MemoryStore } from "./ports.ts";

export const listMemories = (store: MemoryStore, documentId: number) =>
  store.listByDocument(documentId);
