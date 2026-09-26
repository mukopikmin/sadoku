import type { DocumentSummary, PreviewDocument } from "../models/document";
import { parseDocumentTag } from "./tags";

export const parseGitHubHeadSha = (value: unknown): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^[a-f0-9]{40,64}$/.test(value)) {
    throw new Error("Invalid GitHub PR revision.");
  }
  return value;
};

export type DocumentSummaryResponse = DocumentSummary;
export type PreviewDocumentResponse = PreviewDocument;

export const loadDocuments = async (): Promise<DocumentSummary[]> => {
  const response = await fetch("/__sadoku/documents");
  if (!response.ok) {
    throw new Error(`Failed to load documents: ${response.status}`);
  }
  const documents = await response.json() as DocumentSummaryResponse[];
  return documents.map((document) => ({
    ...document,
    tags: Array.isArray(document.tags)
      ? document.tags.map(parseDocumentTag)
      : [],
  }));
};

export const loadPreviewDocument = async (
  documentId: number,
): Promise<PreviewDocument> => {
  const response = await fetch(`/__sadoku/documents/${documentId}`);
  if (!response.ok) {
    throw new Error(`Failed to load Markdown: ${response.status}`);
  }
  const document = await response.json() as PreviewDocumentResponse;
  return {
    ...document,
    githubHeadSha: parseGitHubHeadSha(document.githubHeadSha),
    tags: Array.isArray(document.tags)
      ? document.tags.map(parseDocumentTag)
      : [],
  };
};
