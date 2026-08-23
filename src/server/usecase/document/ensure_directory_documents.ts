import type { DocumentDependencies } from "./ports.ts";
import type { DirectoryDocument } from "./types.ts";
import { basename } from "@std/path";
import { isAbsolute, relative } from "@std/path";

export const ensureDirectoryDocuments = async (
  directoryPath: string,
  deps: DocumentDependencies,
): Promise<DirectoryDocument[]> => {
  const markdownFiles = await deps.listMarkdownFiles(directoryPath);
  const documents = await deps.documentStore.ensureMany(
    markdownFiles.map((document) => document.absolutePath),
  );
  const presentPaths = new Set(
    markdownFiles.map((document) => document.absolutePath),
  );
  const storedDocuments = await deps.documentStore.list();
  const deletedDocuments = storedDocuments.filter((document) => {
    const relativePath = relative(directoryPath, document.filePath);
    return relativePath !== "" && !isAbsolute(relativePath) &&
      relativePath !== ".." && !relativePath.startsWith("../") &&
      !relativePath.startsWith("..\\") &&
      !presentPaths.has(document.filePath);
  });

  return [
    ...documents.map((document, index) => ({
      ...document,
      deleted: false,
      relativePath: markdownFiles[index].relativePath,
      title: basename(markdownFiles[index].relativePath),
    })),
    ...deletedDocuments.map((document) => {
      const relativePath = relative(directoryPath, document.filePath);
      return {
        ...document,
        deleted: true,
        relativePath,
        title: basename(relativePath),
      };
    }),
  ].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
};
