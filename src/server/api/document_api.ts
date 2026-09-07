import { noStoreJson, notFoundResponse } from "../responses.ts";
import {
  createPreviewSource,
  readMarkdownSource,
  sourceUrl,
} from "../source.ts";
import type { DocumentStore } from "../usecase/document/mod.ts";
import {
  getDirectoryDocument,
  isDocumentUseCaseError,
  listDirectoryDocuments,
  loadDirectoryDocument,
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
  return error.type === "document_not_found"
    ? notFoundResponse("Document not found.")
    : notFoundResponse("Saved Markdown snapshot not found.");
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
): Promise<Response> => {
  const id = parseDocumentId(rawId);
  if (id === undefined) return mapError({ type: "document_not_found" });

  try {
    const document = getDirectoryDocument(session, id);
    return noStoreJson(
      await loadDirectoryDocument(document, {
        initializeSnapshot: documentStore?.initializeSnapshot
          ? (documentId, markdown) =>
            documentStore.initializeSnapshot!(documentId, markdown)
          : undefined,
        readMarkdown: async (source) => ({
          fileUrl: sourceUrl(source),
          markdown: await readMarkdownSource(source),
        }),
        readSnapshot: documentStore?.readSnapshot
          ? (documentId) => documentStore.readSnapshot!(documentId)
          : undefined,
        tagReader: tagStore,
      }),
    );
  } catch (error) {
    return mapError(error);
  }
};
