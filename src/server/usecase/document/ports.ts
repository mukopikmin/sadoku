import type { Document, MarkdownDocumentPath } from "./types.ts";

export type DocumentStore = {
  ensure: (filePath: string) => Promise<Document>;
  ensureMany: (filePaths: string[]) => Promise<Document[]>;
  findById: (id: number) => Promise<Document | undefined>;
  findByFilePath: (filePath: string) => Promise<Document | undefined>;
  list: () => Promise<Document[]>;
};

export type ListMarkdownFiles = (
  directoryPath: string,
) => Promise<MarkdownDocumentPath[]>;

export type DocumentDependencies = {
  documentStore: DocumentStore;
  listMarkdownFiles: ListMarkdownFiles;
};
