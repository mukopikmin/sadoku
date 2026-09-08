import type { InitializeDocumentSnapshot } from "./ports.ts";

export const initializeDocumentSnapshot = async (
  initializeSnapshot: InitializeDocumentSnapshot | undefined,
  documentId: number,
  markdown: string,
): Promise<void> => {
  await initializeSnapshot?.(documentId, markdown);
};
