import type { InstructionScope } from "../models/instruction";

export const documentsQueryKey = ["documents"] as const;
export const directoryStatusQueryKey = ["directory-status"] as const;
export const previewDocumentQueryKey = (documentId?: number) =>
  ["preview-document", documentId] as const;
export const documentRevisionsQueryKey = (documentId: number) =>
  ["document-revisions", documentId] as const;
export const documentRevisionQueryKey = (
  documentId: number,
  revisionId?: number,
) => ["document-revision", documentId, revisionId] as const;
export const commentsQueryKey = (documentId?: number) =>
  ["comments", documentId] as const;
export const instructionsQueryKey = (scope?: InstructionScope) =>
  ["instructions", scope] as const;
export const tagsQueryKey = ["tags"] as const;
export const memoriesQueryKey = (documentId?: number) =>
  ["memories", documentId] as const;
