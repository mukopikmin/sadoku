export type CommentAuthor = {
  type: "human" | "bot";
};

export type PreviewCommentReply = {
  author: CommentAuthor;
  body: string;
  createdAt: string;
  id: number;
  updatedAt: string;
};

export type PreviewComment = {
  author: CommentAuthor;
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
  resolvedBy?: CommentAuthor;
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
