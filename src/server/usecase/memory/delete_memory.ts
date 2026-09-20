import type { MemoryStore } from "./ports.ts";

export const deleteMemory = async (
  store: MemoryStore,
  documentId: number,
  memoryId: number,
) => {
  if (!await store.delete(documentId, memoryId)) {
    throw { type: "memory_not_found" } as const;
  }
};
