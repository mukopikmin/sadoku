import { resolve } from "@std/path";
import { ensureDirectoryDocuments } from "./usecase/document/mod.ts";
import type {
  DirectorySession,
  DocumentStore,
} from "./usecase/document/mod.ts";
import { listMarkdownFiles } from "./storage/document/list_markdown_files.ts";

export const createDirectorySession = async (
  rootPath: string,
  documentStore: DocumentStore,
): Promise<DirectorySession> => {
  const resolvedRootPath = resolve(rootPath);
  const documents = await ensureDirectoryDocuments(resolvedRootPath, {
    documentStore,
    listMarkdownFiles,
  });
  return {
    rootPath: resolvedRootPath,
    documents,
    documentsById: new Map(
      documents.map((document) => [document.id, document]),
    ),
  };
};
