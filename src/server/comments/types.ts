export type PreviewCommentReply = {
  body: string;
  createdAt: string;
  id: number;
  updatedAt: string;
};

export type PreviewComment = {
  body: string;
  createdAt: string;
  displayLine?: number;
  endLine: number;
  id: number;
  originalEndLine: number;
  originalStartLine: number;
  replies?: PreviewCommentReply[];
  resolved: boolean;
  resolvedAt?: string;
  sourceHash?: string;
  sourceText?: string;
  stale: boolean;
  startLine: number;
  updatedAt: string;
};

export type PreviewCommentsDocument = {
  comments: PreviewComment[];
  filePath: string;
};
