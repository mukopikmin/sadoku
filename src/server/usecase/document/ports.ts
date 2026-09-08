import type { Document, MarkdownDocumentPath } from "./types.ts";

export type DocumentStore = {
  ensure: (filePath: string) => Promise<Document>;
  ensureMany: (filePaths: string[]) => Promise<Document[]>;
  findById: (id: number) => Promise<Document | undefined>;
  findByFilePath: (filePath: string) => Promise<Document | undefined>;
  list: () => Promise<Document[]>;
  readSnapshot?: (id: number) => Promise<string | undefined>;
  initializeSnapshot?: (id: number, markdown: string) => Promise<void>;
};

export type DocumentTagReader = {
  listForDocument: (documentId: number) => Promise<
    Array<{ id: number; name: string; backgroundColor: string }>
  >;
};

export type ReadMarkdownDocument = (
  source: string,
) => Promise<{ fileUrl?: string; markdown: string }>;

export type ReadDocumentSnapshot = (
  documentId: number,
) => Promise<string | undefined>;

export type InitializeDocumentSnapshot = (
  documentId: number,
  markdown: string,
) => Promise<void>;

export type ListMarkdownFiles = (
  directoryPath: string,
  signal?: AbortSignal,
) => Promise<MarkdownDocumentPath[]>;

export type PathExists = (filePath: string) => Promise<boolean>;

export type DocumentDependencies = {
  documentStore: DocumentStore;
  listMarkdownFiles: ListMarkdownFiles;
  pathExists: PathExists;
};
