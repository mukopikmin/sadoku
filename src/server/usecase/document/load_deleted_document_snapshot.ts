import type { ReadDocumentSnapshot } from "./ports.ts";

export const loadDeletedDocumentSnapshot = async (
  documentId: number,
  readSnapshot?: ReadDocumentSnapshot,
): Promise<{ markdown: string }> => {
  const markdown = await readSnapshot?.(documentId);
  if (markdown === undefined) {
    throw { type: "document_snapshot_not_found" } as const;
  }
  return { markdown };
};
