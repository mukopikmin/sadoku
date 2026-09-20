import type { MemoryDependencies } from "./ports.ts";

export const normalizeMemoryContent = (content: string): string =>
  content.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replace(/\n+$/, "");

export const addMemory = (
  deps: MemoryDependencies,
  documentId: number,
  content: string,
) => {
  const normalized = normalizeMemoryContent(content);
  if (normalized.trim().length === 0) {
    throw { type: "memory_content_empty" } as const;
  }
  return deps.memoryStore.create(documentId, normalized, deps.now());
};
