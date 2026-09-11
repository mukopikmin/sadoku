import { noStoreJson, notFoundResponse } from "../responses.ts";
import { isMemoryError } from "../usecase/memory/errors.ts";
import { deleteMemory, listMemories } from "../usecase/memory/mod.ts";
import type { MemoryStore } from "../usecase/memory/ports.ts";

export const getMemories = async (
  documentId: number,
  store: MemoryStore,
): Promise<Response> =>
  noStoreJson({ memories: await listMemories(store, documentId) });

export const removeMemory = async (
  documentId: number,
  memoryId: number,
  store: MemoryStore,
): Promise<Response> => {
  try {
    await deleteMemory(store, documentId, memoryId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (!isMemoryError(error)) throw error;
    return notFoundResponse("Memory not found.");
  }
};
