import type { DocumentDependencies } from "./ports.ts";
import type { DirectoryDocument } from "./types.ts";

export const ensureDirectoryDocuments = async (
  directoryPath: string,
  deps: DocumentDependencies,
): Promise<DirectoryDocument[]> => {
  const markdownFiles = await deps.listMarkdownFiles(directoryPath);
  const documents = await deps.documentStore.ensureMany(
    markdownFiles.map((document) => document.absolutePath),
  );

  return documents.map((document, index) => ({
    ...document,
    relativePath: markdownFiles[index].relativePath,
  }));
};
