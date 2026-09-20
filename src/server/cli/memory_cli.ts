import { isMemoryError } from "../usecase/memory/errors.ts";
import {
  addMemory as addMemoryUseCase,
  deleteMemory as deleteMemoryUseCase,
  listMemories as listMemoriesUseCase,
  updateMemory as updateMemoryUseCase,
} from "../usecase/memory/mod.ts";
import type { MemoryStore } from "../usecase/memory/ports.ts";

const dependencies = (memoryStore: MemoryStore) => ({
  memoryStore,
  now: () => new Date().toISOString(),
});

const mapUseCaseError = (error: unknown): never => {
  if (!isMemoryError(error)) throw error;
  if (error.type === "memory_content_empty") {
    throw new Error("Memory content must not be empty.");
  }
  throw new Error("Memory not found.");
};

export const listMemories = (
  documentId: number,
  store: MemoryStore,
) => listMemoriesUseCase(store, documentId);

export const addMemory = async (
  documentId: number,
  content: string,
  store: MemoryStore,
) => {
  try {
    return await addMemoryUseCase(
      dependencies(store),
      documentId,
      content,
    );
  } catch (error) {
    return mapUseCaseError(error);
  }
};

export const updateMemory = async (
  documentId: number,
  memoryId: number,
  content: string,
  store: MemoryStore,
) => {
  try {
    return await updateMemoryUseCase(
      dependencies(store),
      documentId,
      memoryId,
      content,
    );
  } catch (error) {
    return mapUseCaseError(error);
  }
};

export const deleteMemory = async (
  documentId: number,
  memoryId: number,
  store: MemoryStore,
): Promise<void> => {
  try {
    await deleteMemoryUseCase(store, documentId, memoryId);
  } catch (error) {
    mapUseCaseError(error);
  }
};
