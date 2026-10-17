import { connectFailure } from "../connect/unary.ts";
import { createLocalDocumentCreator } from "../storage/document/create_local_document.ts";
import { defaultMarkdownExtensions } from "../storage/document/list_markdown_files.ts";
import {
  createDocument,
  type CreateDocumentError,
  type CreateDocumentInput,
} from "../usecase/document/create_document.ts";
import type {
  DirectorySession,
  DocumentStore,
} from "../usecase/document/mod.ts";

export const createDocumentResponse = async (
  input: CreateDocumentInput,
  session: DirectorySession,
  documentStore: DocumentStore | undefined,
  ready: boolean,
  markdownExtensions: readonly string[] = defaultMarkdownExtensions,
) => {
  if (!documentStore || !ready || !session.canCreateDocuments) {
    throw connectFailure(
      "failed_precondition",
      "File creation is unavailable in this preview.",
      412,
    );
  }
  try {
    const { filePath: _, ...document } = await createDocument(session, input, {
      documentStore,
      creator: createLocalDocumentCreator(session.rootPath),
      markdownExtensions,
    });
    return { ...document, id: BigInt(document.id) };
  } catch (error) {
    if (typeof error === "object" && error !== null && "type" in error) {
      const failure = error as CreateDocumentError;
      switch (failure.type) {
        case "invalid_document_input":
          throw connectFailure("invalid_argument", failure.message, 400);
        case "document_exists":
          throw connectFailure("already_exists", failure.message, 409);
        case "creation_unavailable":
          throw connectFailure("failed_precondition", failure.message, 412);
        case "document_registration_failed":
          throw connectFailure("internal", failure.message, 500);
      }
    }
    if (error instanceof Deno.errors.PermissionDenied) {
      throw connectFailure(
        "failed_precondition",
        "The destination directory is not writable.",
        412,
      );
    }
    throw error;
  }
};
