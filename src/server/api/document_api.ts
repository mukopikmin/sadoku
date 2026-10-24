import { readDirectoryDocument } from "../preview/load_document.ts";
import { noStoreJson, notFoundResponse } from "../responses.ts";
import { createPreviewSource, readMarkdownSource } from "../source.ts";
import type { DocumentStore } from "../usecase/document/mod.ts";
import {
  getDirectoryDocument,
  isDocumentUseCaseError,
  listDirectoryDocuments,
} from "../usecase/document/mod.ts";
import type { DirectorySession } from "../usecase/document/mod.ts";
import type { TagStore } from "../usecase/tag/ports.ts";

const parseDocumentId = (rawId: string): number | undefined => {
  if (!/^[1-9]\d*$/.test(rawId)) return undefined;
  const id = Number(rawId);
  return Number.isSafeInteger(id) ? id : undefined;
};

const mapError = (error: unknown): Response => {
  if (!isDocumentUseCaseError(error)) throw error;
  return notFoundResponse(
    {
      document_not_found: "Document not found.",
      document_snapshot_not_found: "Saved Markdown snapshot not found.",
      document_revision_not_found: "Document revision not found.",
    }[error.type],
  );
};

export const resolveDirectoryDocumentParameter = (
  rawId: string,
  session: DirectorySession,
) => {
  const id = parseDocumentId(rawId);
  if (id === undefined) throw mapError({ type: "document_not_found" });
  try {
    const document = getDirectoryDocument(session, id);
    return { document, source: createPreviewSource(document.filePath) };
  } catch (error) {
    throw mapError(error);
  }
};

export const listDirectoryDocumentsResponse = async (
  session: DirectorySession,
  tagStore?: TagStore,
): Promise<Response> =>
  noStoreJson(await listDirectoryDocuments(session.documents, tagStore));

export const getDirectoryDocumentResponse = async (
  rawId: string,
  session: DirectorySession,
  documentStore?: DocumentStore,
  tagStore?: TagStore,
  readMarkdown = readMarkdownSource,
): Promise<Response> => {
  const id = parseDocumentId(rawId);
  if (id === undefined) return mapError({ type: "document_not_found" });

  try {
    const document = getDirectoryDocument(session, id);
    const content = await readDirectoryDocument(
      document,
      documentStore,
      tagStore,
      readMarkdown,
    );
    return noStoreJson({
      ...content,
      ...(session.githubPull
        ? {
          githubHeadSha: new URL(document.filePath).searchParams.get("ref"),
        }
        : {}),
    });
  } catch (error) {
    return mapError(error);
  }
};
