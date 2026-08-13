import {
  listMarkdownFiles,
  type MarkdownDocumentPath,
} from "./list_markdown_files.ts";
import type { DocumentStore } from "./storage.ts";
import type { Document } from "./types.ts";

export type DirectoryDocument = Document & {
  relativePath: string;
};

export type ListMarkdownFiles = (
  directoryPath: string,
) => Promise<MarkdownDocumentPath[]>;

export const ensureDirectoryDocuments = async (
  directoryPath: string,
  documentStore: DocumentStore,
  listFiles: ListMarkdownFiles = listMarkdownFiles,
): Promise<DirectoryDocument[]> => {
  const markdownFiles = await listFiles(directoryPath);
  const documents = await documentStore.ensureMany(
    markdownFiles.map((document) => document.absolutePath),
  );

  return documents.map((document, index) => ({
    ...document,
    relativePath: markdownFiles[index].relativePath,
  }));
};
