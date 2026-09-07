export type DocumentUseCaseError =
  | { type: "document_not_found" }
  | { type: "document_snapshot_not_found" };

export const isDocumentUseCaseError = (
  error: unknown,
): error is DocumentUseCaseError =>
  typeof error === "object" && error !== null && "type" in error &&
  (error.type === "document_not_found" ||
    error.type === "document_snapshot_not_found");
