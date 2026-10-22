import type { DocumentRevisionReader } from "./ports.ts";

export const listDocumentRevisions = (
  documentId: number,
  reader: Pick<DocumentRevisionReader, "listRevisions">,
) => reader.listRevisions(documentId, 20);
