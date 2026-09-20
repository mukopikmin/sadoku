import type { DocumentMemory } from "../models/memory";

type MemoryResponse = {
  content: unknown;
  createdAt: unknown;
  documentId: unknown;
  id: unknown;
  updatedAt: unknown;
};
type MemoriesResponse = { memories: unknown };

const toMemory = (value: unknown): DocumentMemory => {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid memory response.");
  }
  const response = value as MemoryResponse;
  if (
    typeof response.id !== "number" ||
    typeof response.documentId !== "number" ||
    typeof response.content !== "string" ||
    typeof response.createdAt !== "string" ||
    typeof response.updatedAt !== "string"
  ) {
    throw new Error("Invalid memory response.");
  }
  return {
    id: response.id,
    documentId: response.documentId,
    content: response.content,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
};

const path = (documentId: number) =>
  `/__sadoku/documents/${documentId}/memories`;

export const loadMemories = async (
  documentId: number,
): Promise<DocumentMemory[]> => {
  const response = await fetch(path(documentId));
  if (!response.ok) {
    throw new Error(`Failed to load memories: ${response.status}`);
  }
  const body = (await response.json()) as MemoriesResponse;
  if (!Array.isArray(body.memories)) {
    throw new Error("Invalid memories response.");
  }
  return body.memories.map(toMemory);
};

export const deleteMemory = async (
  documentId: number,
  memoryId: number,
): Promise<void> => {
  const response = await fetch(`${path(documentId)}/${memoryId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete memory: ${response.status}`);
  }
};
