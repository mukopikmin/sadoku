import type {
  DocumentRevision,
  DocumentRevisionSummary,
} from "../models/documentRevision";
import { connectHttpStatus, previewClient } from "./connect";

export const toDocumentRevisionSummary = (
  value: unknown,
): DocumentRevisionSummary => {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid saved revision response.");
  }
  const revision = value as { id: unknown; recordedAt: unknown };
  const id = Number(revision.id);
  if (
    (typeof revision.id !== "bigint" && typeof revision.id !== "number") ||
    !Number.isSafeInteger(id) || id < 1 ||
    typeof revision.recordedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
      revision.recordedAt,
    ) ||
    !Number.isFinite(Date.parse(revision.recordedAt)) ||
    new Date(revision.recordedAt).toISOString() !== revision.recordedAt
  ) throw new Error("Invalid saved revision response.");
  return { id, recordedAt: revision.recordedAt };
};

export const toDocumentRevision = (value: unknown): DocumentRevision => {
  const summary = toDocumentRevisionSummary(value);
  const { markdown, previousMarkdown } = value as {
    markdown: unknown;
    previousMarkdown?: unknown;
  };
  if (
    typeof markdown !== "string" ||
    (previousMarkdown !== undefined && typeof previousMarkdown !== "string")
  ) {
    throw new Error("Invalid saved revision response.");
  }
  return {
    ...summary,
    markdown,
    ...(previousMarkdown !== undefined && { previousMarkdown }),
  };
};

export const toDocumentRevisions = (
  value: unknown,
): DocumentRevisionSummary[] => {
  if (!Array.isArray(value) || value.length > 20) {
    throw new Error("Invalid saved revisions response.");
  }
  const revisions = value.map(toDocumentRevisionSummary);
  if (
    revisions.some((revision, index) =>
      index > 0 && revision.id >= revisions[index - 1].id
    )
  ) {
    throw new Error("Invalid saved revisions response.");
  }
  return revisions;
};

export const loadDocumentRevisions = async (
  documentId: number,
  signal?: AbortSignal,
): Promise<DocumentRevisionSummary[]> => {
  const response = await previewClient.listDocumentRevisions({
    documentId: BigInt(documentId),
  }, { signal })
    .catch((error) => {
      throw new Error(
        `Failed to load saved revisions: ${connectHttpStatus(error)}`,
      );
    });
  return toDocumentRevisions(response.revisions);
};

export const loadDocumentRevision = async (
  documentId: number,
  revisionId: number,
  signal?: AbortSignal,
): Promise<DocumentRevision> => {
  const response = await previewClient.getDocumentRevision({
    documentId: BigInt(documentId),
    revisionId: BigInt(revisionId),
  }, { signal }).catch((error) => {
    throw new Error(
      `Failed to load saved revision: ${connectHttpStatus(error)}`,
    );
  });
  const revision = toDocumentRevision(response);
  if (revision.id !== revisionId) {
    throw new Error("Invalid saved revision response.");
  }
  return revision;
};
