import type { DocumentRevisionReader } from "./ports.ts";

export const getDocumentRevision = async (
  documentId: number,
  revisionId: number,
  reader: Pick<DocumentRevisionReader, "findRevision">,
) => {
  const revision = await reader.findRevision(documentId, revisionId);
  if (!revision) throw { type: "document_revision_not_found" } as const;
  return revision;
};
