import { extname, join, resolve } from "@std/path";
import type { MarkdownDocumentPath } from "../../usecase/document/types.ts";

const markdownExtensions = new Set([".md", ".markdown"]);
const excludedDirectories = new Set([".git", "node_modules"]);
export const defaultDirectoryScanOptions = {
  maxDepth: 2,
  maxFiles: 20,
} as const;

export type DirectoryScanOptions = {
  maxDepth?: number;
  maxFiles?: number;
};

export const listMarkdownFiles = async (
  directoryPath: string,
  options: DirectoryScanOptions = {},
  signal?: AbortSignal,
): Promise<MarkdownDocumentPath[]> => {
  const absoluteDirectoryPath = resolve(directoryPath);
  const documents: MarkdownDocumentPath[] = [];
  const maxDepth = options.maxDepth ?? defaultDirectoryScanOptions.maxDepth;
  const maxFiles = options.maxFiles ?? defaultDirectoryScanOptions.maxFiles;

  const visitDirectory = async (
    absolutePath: string,
    relativePath: string,
    depth: number,
  ): Promise<void> => {
    for await (const entry of Deno.readDir(absolutePath)) {
      signal?.throwIfAborted();
      if (documents.length >= maxFiles) return;
      if (entry.isSymlink) continue;

      const entryAbsolutePath = join(absolutePath, entry.name);
      const entryRelativePath = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name;
      if (entry.isDirectory) {
        if (
          depth < maxDepth &&
          !excludedDirectories.has(entry.name)
        ) {
          await visitDirectory(entryAbsolutePath, entryRelativePath, depth + 1);
        }
        continue;
      }
      if (!entry.isFile) continue;
      if (!markdownExtensions.has(extname(entry.name).toLowerCase())) continue;
      documents.push({
        absolutePath: entryAbsolutePath,
        relativePath: entryRelativePath,
      });
    }
  };

  await visitDirectory(absoluteDirectoryPath, "", 0);
  signal?.throwIfAborted();

  return documents.sort((left, right) =>
    left.relativePath < right.relativePath
      ? -1
      : left.relativePath > right.relativePath
      ? 1
      : 0
  );
};
