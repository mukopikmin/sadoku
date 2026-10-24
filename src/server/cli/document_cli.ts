import { basename, dirname } from "@std/path";
import { readConfig } from "../config.ts";
import { createPreviewSource } from "../source.ts";
import { createLocalDocumentCreator } from "../storage/document/create_local_document.ts";
import { defaultMarkdownExtensions } from "../storage/document/list_markdown_files.ts";
import {
  createDocument,
  type CreateDocumentError,
} from "../usecase/document/create_document.ts";
import type {
  DocumentStore,
  DocumentTagReader,
} from "../usecase/document/mod.ts";
import {
  getDocument,
  listDocuments,
  registerDocument,
} from "../usecase/document/mod.ts";

export const addDocument = async (
  input: string,
  store: DocumentStore,
  options: { create?: boolean; title?: string } = {},
) => {
  const source = createPreviewSource(input);
  if (!options.create) return registerDocument(store, source.commentSource);
  if (
    source.isRemote || !input.trim() || /[\\/]$/.test(input) ||
    /^[.]{1,2}$/.test(basename(input))
  ) {
    throw new Error("--create requires a local Markdown filename.");
  }
  const rootPath = dirname(source.documentSource);
  try {
    const document = await createDocument({
      canCreateDocuments: true,
      rootPath,
      documents: [],
      documentsById: new Map(),
    }, {
      directory: "",
      filename: basename(source.documentSource),
      title: options.title ?? "",
    }, {
      documentStore: store,
      creator: createLocalDocumentCreator(rootPath),
      markdownExtensions: readConfig()?.markdownExtensions ??
        defaultMarkdownExtensions,
    });
    return {
      filePath: document.filePath,
      id: document.id,
      ...(document.displayTitle ? { displayTitle: document.displayTitle } : {}),
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "type" in error) {
      const failure = error as CreateDocumentError;
      switch (failure.type) {
        case "invalid_document_input":
        case "document_exists":
        case "creation_unavailable":
          throw new Error(failure.message);
        case "document_registration_failed":
          throw new Error(
            "The file was created, but registration failed. Run document add without --create to register it.",
          );
      }
    }
    throw error;
  }
};

export const inspectDocument = (
  id: number,
  store: DocumentStore,
  tags?: DocumentTagReader,
) => getDocument(store, id, tags);

export const listRegisteredDocuments = (
  store: DocumentStore,
  tags?: DocumentTagReader,
) => listDocuments(store, tags);
