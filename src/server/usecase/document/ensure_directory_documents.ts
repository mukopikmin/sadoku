import type { DocumentDependencies } from "./ports.ts";
import type { DirectoryDocument } from "./types.ts";
import { isAbsolute, relative } from "@std/path";
import { toDocumentRelativePath } from "./relative_path.ts";

const documentTitle = (relativePath: string): string =>
  relativePath.split("/").at(-1) ?? relativePath;

export const ensureDirectoryDocuments = async (
  directoryPath: string,
  deps: DocumentDependencies,
  maxDocuments: number,
  options: {
    signal?: AbortSignal;
    onDetected?: (count: number) => void;
    onRegistered?: (count: number) => void;
  } = {},
): Promise<DirectoryDocument[]> => {
  options.signal?.throwIfAborted();
  const markdownFiles = (await deps.listMarkdownFiles(
    directoryPath,
    options.signal,
  )).slice(
    0,
    maxDocuments,
  );
  options.onDetected?.(markdownFiles.length);
  options.signal?.throwIfAborted();
  const documents = await deps.documentStore.ensureMany(
    markdownFiles.map((document) => document.absolutePath),
  );
  options.onRegistered?.(documents.length);
  options.signal?.throwIfAborted();
  const presentPaths = new Set(
    markdownFiles.map((document) => document.absolutePath),
  );
  const storedDocuments = await deps.documentStore.list();
  const storedDocumentsInDirectory = storedDocuments.filter((document) => {
    if (!isAbsolute(document.filePath)) return false;
    const relativePath = relative(directoryPath, document.filePath);
    return relativePath !== "" && !isAbsolute(relativePath) &&
      relativePath !== ".." && !relativePath.startsWith("../") &&
      !relativePath.startsWith("..\\") &&
      !presentPaths.has(document.filePath);
  });

  const deletedDocuments = [];
  const deletedDocumentLimit = Math.max(0, maxDocuments - documents.length);
  for (const document of storedDocumentsInDirectory) {
    options.signal?.throwIfAborted();
    if (deletedDocuments.length >= deletedDocumentLimit) break;
    if (!await deps.pathExists(document.filePath)) {
      deletedDocuments.push(document);
    }
  }

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
