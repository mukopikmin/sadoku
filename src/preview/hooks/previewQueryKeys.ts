export const documentsQueryKey = ["documents"] as const;
export const directoryStatusQueryKey = ["directory-status"] as const;
export const previewDocumentQueryKey = (documentId?: number) =>
  ["preview-document", documentId] as const;
export const commentsQueryKey = (documentId?: number) =>
  ["comments", documentId] as const;
export const instructionsQueryKey = (documentId?: number) =>
  ["instructions", documentId] as const;
export const tagsQueryKey = ["tags"] as const;
