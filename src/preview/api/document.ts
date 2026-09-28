import type { DocumentSummary, PreviewDocument } from "../models/document";
import { parseDocumentTag } from "./tags";
import { connectHttpStatus, previewClient } from "./connect";

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
  const { documents } = await previewClient.listDocuments({}).catch((error) => {
    throw new Error(`Failed to load documents: ${connectHttpStatus(error)}`);
  });
  return documents.map((document) => ({
    ...document,
    id: Number(document.id),
    tags: Array.isArray(document.tags)
      ? document.tags.map(parseDocumentTag)
      : [],
  }));
};

export const loadPreviewDocument = async (
  documentId: number,
): Promise<PreviewDocument> => {
  const document = await previewClient.getDocument({
    documentId: BigInt(documentId),
  }).catch((error) => {
    throw new Error(`Failed to load Markdown: ${connectHttpStatus(error)}`);
  });
  return {
    ...document,
    githubHeadSha: parseGitHubHeadSha(document.githubHeadSha),
    tags: Array.isArray(document.tags)
      ? document.tags.map(parseDocumentTag)
      : [],
  };
};
