import type { DocumentSummary, PreviewDocument } from "../models/document";

export type DocumentSummaryResponse = DocumentSummary;
export type PreviewDocumentResponse = PreviewDocument;

export const loadDocuments = async (): Promise<DocumentSummary[]> => {
  const response = await fetch("/__sadoku/documents");
  if (!response.ok) {
    throw new Error(`Failed to load documents: ${response.status}`);
  }
  return await response.json() as DocumentSummaryResponse[];
};

export const loadPreviewDocument = async (
  documentId: number,
): Promise<PreviewDocument> => {
  const response = await fetch(`/__sadoku/documents/${documentId}`);
  if (!response.ok) {
    throw new Error(`Failed to load Markdown: ${response.status}`);
  }
  return await response.json() as PreviewDocument;
};
