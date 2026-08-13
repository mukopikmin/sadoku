import { extname, join, resolve } from "@std/path";

export type MarkdownDocumentPath = {
  absolutePath: string;
  relativePath: string;
};

const markdownExtensions = new Set([".md", ".markdown"]);

export const listMarkdownFiles = async (
  directoryPath: string,
): Promise<MarkdownDocumentPath[]> => {
  const absoluteDirectoryPath = resolve(directoryPath);
  const documents: MarkdownDocumentPath[] = [];

  for await (const entry of Deno.readDir(absoluteDirectoryPath)) {
    if (!entry.isFile || entry.isSymlink) continue;
    if (!markdownExtensions.has(extname(entry.name).toLowerCase())) continue;
    documents.push({
      absolutePath: join(absoluteDirectoryPath, entry.name),
      relativePath: entry.name,
    });
  }

  return documents.sort((left, right) =>
    left.relativePath < right.relativePath
      ? -1
      : left.relativePath > right.relativePath
      ? 1
      : 0
  );
};
