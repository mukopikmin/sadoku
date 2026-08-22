import { basename, dirname, resolve } from "@std/path";
import { ensureDirectoryDocuments } from "./usecase/document/mod.ts";
import type {
  DirectorySession,
  DocumentStore,
} from "./usecase/document/mod.ts";
import { listMarkdownFiles } from "./storage/document/list_markdown_files.ts";
import { createPreviewSource } from "./source.ts";

const createSession = (
  rootPath: string,
  documents: DirectorySession["documents"],
): DirectorySession => ({
  rootPath,
  documents,
  documentsById: new Map(documents.map((document) => [document.id, document])),
});

export const createDirectorySession = async (
  rootPath: string,
  documentStore: DocumentStore,
): Promise<DirectorySession> => {
  const resolvedRootPath = resolve(rootPath);
  const documents = await ensureDirectoryDocuments(resolvedRootPath, {
    documentStore,
    listMarkdownFiles,
  });
  return createSession(resolvedRootPath, documents);
};

/**
 * Normalizes every preview target to the multi-document session contract.
 * A file or URL is represented as a session containing exactly one document,
 * so the HTTP and browser layers do not need a separate single-file mode.
 */
export const createPreviewSession = async (
  input: string,
  documentStore: DocumentStore,
): Promise<DirectorySession> => {
  const source = createPreviewSource(input);
  if (source.isRemote) {
    const document = await documentStore.ensure(source.commentSource);
    const title = basename(new URL(source.documentSource).pathname) ||
      new URL(source.documentSource).hostname;
    return createSession(source.documentSource, [{
      ...document,
      filePath: source.documentSource,
      relativePath: title,
      title,
    }]);
  }

  const stat = await Deno.stat(source.documentSource).catch(() => undefined);
  if (!stat || (!stat.isFile && !stat.isDirectory)) {
    throw new Error(
      `Markdown file or directory not found: ${source.documentSource}`,
    );
  }
  if (stat.isDirectory) {
    return await createDirectorySession(source.documentSource, documentStore);
  }

  const document = await documentStore.ensure(source.documentSource);
  const title = basename(source.documentSource);
  return createSession(dirname(source.documentSource), [{
    ...document,
    relativePath: title,
    title,
  }]);
};
