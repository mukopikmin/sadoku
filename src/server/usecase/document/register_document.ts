import type { DocumentStore } from "./ports.ts";

export const registerDocument = (
  documentStore: DocumentStore,
  source: string,
) => documentStore.ensure(source);
