import type { DocumentSummary } from "../models/document";

export type PreviewDocument = {
  fileUrl: string;
  markdown: string;
  title: string;
};

export type DocumentSummaryResponse = DocumentSummary;

export const loadDocuments = async (): Promise<DocumentSummary[] | null> => {
  const response = await fetch("/__sadoku/documents");
  // A missing collection endpoint identifies the legacy single-file/URL mode.
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load documents: ${response.status}`);
  }
  return (await response.json() as DocumentSummaryResponse[]).map((
    document,
  ) => ({
    id: document.id,
    relativePath: document.relativePath,
    title: document.title,
  }));
};

export const loadPreviewDocument = async (
  documentId?: number,
): Promise<PreviewDocument> => {
  const response = await fetch(
    documentId === undefined
      ? "/__sadoku/document"
      : `/__sadoku/documents/${encodeURIComponent(documentId)}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to load Markdown: ${response.status}`);
  }
  return await response.json() as PreviewDocument;
};
