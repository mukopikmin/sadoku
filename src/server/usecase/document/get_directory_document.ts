import type { DirectoryDocument, DirectorySession } from "./types.ts";

export const getDirectoryDocument = (
  session: DirectorySession,
  id: number,
): DirectoryDocument => {
  const document = session.documentsById.get(id);
  if (!document) throw { type: "document_not_found" } as const;
  return document;
};
