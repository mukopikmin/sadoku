import type { PreviewCommentsDocument } from "./types.ts";

export type CommentsStoreFile = {
  commentCount: number;
  fileName: string;
  markdownPath: string;
  openCount: number;
  updatedAt: string | undefined;
};

export type CommentsStoreFileList = {
  entries: CommentsStoreFile[];
  warnings: string[];
};

/** Persistence port used by comment use cases. */
export type CommentsStore = {
  delete: (filePath: string) => Promise<void>;
  list: () => Promise<CommentsStoreFileList>;
  read: (filePath: string) => Promise<PreviewCommentsDocument>;
  write: (filePath: string, document: PreviewCommentsDocument) => Promise<void>;
};

export type MarkdownSourceReader = (source: string) => Promise<string>;
export type Clock = () => string;

export type CommentsDependencies = {
  commentsStore: CommentsStore;
  readMarkdown: MarkdownSourceReader;
  now: Clock;
};
