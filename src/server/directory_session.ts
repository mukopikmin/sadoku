import { basename, dirname, resolve } from "@std/path";
import { ensureDirectoryDocuments } from "./usecase/document/mod.ts";
import type {
  DirectorySession,
  DocumentStore,
} from "./usecase/document/mod.ts";
import {
  defaultDirectoryScanOptions,
  type DirectoryScanOptions,
  listMarkdownFiles,
} from "./storage/document/list_markdown_files.ts";
import { pathExists } from "./storage/document/path_exists.ts";
import { createPreviewSource } from "./source.ts";

const createSession = (
  rootPath: string,
  documents: DirectorySession["documents"],
): DirectorySession => ({
  rootPath,
  documents,
  documentsById: new Map(documents.map((document) => [document.id, document])),
});

export type DirectorySessionStatus =
  | { state: "loading"; detected: number; registered: number }
  | { state: "ready"; detected: number; registered: number }
  | {
    state: "error";
    detected: number;
    registered: number;
    error: { name: string; message: string };
  };

export type DirectorySessionState = {
  session: DirectorySession;
  status: DirectorySessionStatus;
};

export const createLoadingDirectorySession = (
  rootPath: string,
): DirectorySessionState => ({
  session: createSession(resolve(rootPath), []),
  status: { state: "loading", detected: 0, registered: 0 },
});

export const prepareDirectorySession = async (
  state: DirectorySessionState,
  documentStore: DocumentStore,
  scanOptions: DirectoryScanOptions = {},
  signal?: AbortSignal,
): Promise<void> => {
  try {
    const documents = await ensureDirectoryDocuments(
      state.session.rootPath,
      {
        documentStore,
        listMarkdownFiles: (directoryPath, scanSignal) =>
          listMarkdownFiles(directoryPath, scanOptions, scanSignal),
        pathExists,
      },
      scanOptions.maxFiles ?? defaultDirectoryScanOptions.maxFiles,
      {
        signal,
        onDetected: (detected) => {
          state.status = { ...state.status, detected };
        },
        onRegistered: (registered) => {
          state.status = { ...state.status, registered };
        },
      },
    );
    state.session.documents.splice(
      0,
      state.session.documents.length,
      ...documents,
    );
    state.session.documentsById.clear();
    for (const document of documents) {
      state.session.documentsById.set(document.id, document);
    }
    state.status = {
      state: "ready",
      detected: state.status.detected,
      registered: state.status.registered,
    };
  } catch (error) {
    const normalized = error instanceof Error
      ? error
      : new Error(String(error));
    state.status = {
      state: "error",
      detected: state.status.detected,
      registered: state.status.registered,
      error: { name: normalized.name, message: normalized.message },
    };
  }
};

export const createDirectorySession = async (
  rootPath: string,
  documentStore: DocumentStore,
  scanOptions: DirectoryScanOptions = {},
): Promise<DirectorySession> => {
  const resolvedRootPath = resolve(rootPath);
  const documents = await ensureDirectoryDocuments(resolvedRootPath, {
    documentStore,
    listMarkdownFiles: (directoryPath, signal) =>
      listMarkdownFiles(directoryPath, scanOptions, signal),
    pathExists,
  }, scanOptions.maxFiles ?? defaultDirectoryScanOptions.maxFiles);
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
  scanOptions: DirectoryScanOptions = {},
): Promise<DirectorySession> => {
  const source = createPreviewSource(input);
  if (source.isRemote) {
    const document = await documentStore.ensure(source.commentSource);
    const title = basename(new URL(source.documentSource).pathname) ||
      new URL(source.documentSource).hostname;
    return createSession(source.documentSource, [{
      ...document,
      deleted: false,
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
    return await createDirectorySession(
      source.documentSource,
      documentStore,
      scanOptions,
    );
  }

  const document = await documentStore.ensure(source.documentSource);
  const title = basename(source.documentSource);
  return createSession(dirname(source.documentSource), [{
    ...document,
    deleted: false,
    relativePath: title,
    title,
  }]);
};
