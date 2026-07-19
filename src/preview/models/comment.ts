export type CommentReply = {
  body: string;
  createdAt: string;
  id: number;
  updatedAt: string;
};

type CommentBase = {
  body: string;
  createdAt: string;
  endLine: number;
  id: number;
  originalEndLine: number;
  originalStartLine: number;
  replies?: CommentReply[];
  sourceHash?: string;
  sourceText?: string;
  startLine: number;
  updatedAt: string;
};

export type ActiveComment = CommentBase & {
  state: "active";
};

export type StaleComment = CommentBase & {
  state: "stale";
};

export type ResolvedComment = CommentBase & {
  resolvedAt?: string;
  state: "resolved";
};

export type Comment = ActiveComment | StaleComment | ResolvedComment;

export type CommentsDocument = {
  comments: Comment[];
  filePath: string;
};
