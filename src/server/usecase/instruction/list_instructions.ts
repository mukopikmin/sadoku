import type { InstructionStore } from "./ports.ts";

export const listInstructions = (store: InstructionStore, documentId: number) =>
  store.listByDocument(documentId);
