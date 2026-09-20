import { normalizeMemoryContent } from "./add_memory.ts";
import type { MemoryDependencies } from "./ports.ts";

export const updateMemory = async (
  deps: MemoryDependencies,
  documentId: number,
  memoryId: number,
  content: string,
) => {
  const normalized = normalizeMemoryContent(content);
  if (normalized.trim().length === 0) {
    throw { type: "memory_content_empty" } as const;
  }
  const memory = await deps.memoryStore.update(
    documentId,
    memoryId,
    normalized,
    deps.now(),
  );
  if (!memory) throw { type: "memory_not_found" } as const;
  return memory;
};
