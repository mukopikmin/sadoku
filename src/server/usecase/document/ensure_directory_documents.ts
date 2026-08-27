import type { DocumentDependencies } from "./ports.ts";
import type { DirectoryDocument } from "./types.ts";
import { isAbsolute, relative } from "@std/path";
import { toDocumentRelativePath } from "./relative_path.ts";

const documentTitle = (relativePath: string): string =>
  relativePath.split("/").at(-1) ?? relativePath;

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
    if (!isAbsolute(document.filePath)) return false;
    const relativePath = relative(directoryPath, document.filePath);
    return relativePath !== "" && !isAbsolute(relativePath) &&
      relativePath !== ".." && !relativePath.startsWith("../") &&
      !relativePath.startsWith("..\\") &&
      !presentPaths.has(document.filePath);
  });

  return [
    ...documents.map((document, index) => {
      const relativePath = toDocumentRelativePath(
        markdownFiles[index].relativePath,
      );
      return {
        ...document,
        deleted: false,
        relativePath,
        title: documentTitle(relativePath),
      };
    }),
    ...deletedDocuments.map((document) => {
      const relativePath = toDocumentRelativePath(
        relative(directoryPath, document.filePath),
      );
      return {
        ...document,
        deleted: true,
        relativePath,
        title: documentTitle(relativePath),
      };
    }),
  ].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
};
