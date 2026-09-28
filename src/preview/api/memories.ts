import type { DocumentMemory } from "../models/memory";
import { previewClient } from "./connect";

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
    (typeof response.id !== "number" && typeof response.id !== "bigint") ||
    (typeof response.documentId !== "number" &&
      typeof response.documentId !== "bigint") ||
    Number(response.id) < 1 || Number(response.documentId) < 1 ||
    typeof response.content !== "string" ||
    typeof response.createdAt !== "string" ||
    response.createdAt.length === 0 || typeof response.updatedAt !== "string" ||
    response.updatedAt.length === 0
  ) {
    throw new Error("Invalid memory response.");
  }
  return {
    id: Number(response.id),
    documentId: Number(response.documentId),
    content: response.content,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
};

export const loadMemories = async (
  documentId: number,
): Promise<DocumentMemory[]> => {
  const body = await previewClient.listMemories({
    documentId: BigInt(documentId),
  });
  if (!Array.isArray(body.memories)) {
    throw new Error("Invalid memories response.");
  }
  return body.memories.map(toMemory);
};

export const deleteMemory = async (
  documentId: number,
  memoryId: number,
): Promise<void> => {
  await previewClient.deleteMemory({
    documentId: BigInt(documentId),
    memoryId: BigInt(memoryId),
  });
};
