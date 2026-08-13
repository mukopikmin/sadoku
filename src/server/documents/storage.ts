import type { Document } from "./types.ts";

export type DocumentStore = {
  ensure: (filePath: string) => Promise<Document>;
  ensureMany: (filePaths: string[]) => Promise<Document[]>;
  findById: (id: number) => Promise<Document | undefined>;
  findByFilePath: (filePath: string) => Promise<Document | undefined>;
};
