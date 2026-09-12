import type { DocumentMemory } from "./types.ts";

export type MemoryStore = {
  create: (
    documentId: number,
    content: string,
    now: string,
  ) => Promise<DocumentMemory>;
  delete: (documentId: number, memoryId: number) => Promise<boolean>;
  listByDocument: (documentId: number) => Promise<DocumentMemory[]>;
  update: (
    documentId: number,
    memoryId: number,
    content: string,
    now: string,
  ) => Promise<DocumentMemory | undefined>;
};

export type MemoryDependencies = {
  memoryStore: MemoryStore;
  now: () => string;
};
