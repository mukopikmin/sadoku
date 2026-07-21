import {
  type Comment,
  type CommentReply,
  type CommentsDocument,
} from "../models/comment";

export type CommentReplyResponse = {
  author: CommentAuthorResponse;
  body: string;
  createdAt: string;
  id: number;
  updatedAt: string;
};

export type CommentResponse = {
  author: CommentAuthorResponse;
  body: string;
  createdAt: string;
  endLine: number;
  id: number;
  originalEndLine: number;
  originalStartLine: number;
  replies?: CommentReplyResponse[];
  resolved: boolean;
  resolvedAt?: string;
  sourceHash?: string;
  sourceText?: string;
  stale: boolean;
  startLine: number;
  updatedAt: string;
};

type CommentAuthorResponse = {
  type: Comment["author"]["type"];
};

export type CommentsDocumentResponse = {
  comments: CommentResponse[];
  filePath: string;
};

const toCommentReply = (response: CommentReplyResponse): CommentReply => ({
  author: { type: response.author.type },
  body: response.body,
  createdAt: response.createdAt,
  id: response.id,
  updatedAt: response.updatedAt,
});

export const toComment = (response: CommentResponse): Comment => {
  const common = {
    author: { type: response.author.type },
    body: response.body,
    createdAt: response.createdAt,
    endLine: response.endLine,
    id: response.id,
    originalEndLine: response.originalEndLine,
    originalStartLine: response.originalStartLine,
    replies: (response.replies ?? []).map(toCommentReply),
    sourceHash: response.sourceHash,
    sourceText: response.sourceText,
    startLine: response.startLine,
    updatedAt: response.updatedAt,
  };

  if (response.resolved) {
    return {
      ...common,
      resolvedAt: response.resolvedAt,
      state: "resolved",
    };
  }
  return { ...common, state: response.stale ? "stale" : "active" };
};

export const toCommentsDocument = (
  response: CommentsDocumentResponse,
): CommentsDocument => ({
  comments: response.comments.map(toComment),
  filePath: response.filePath,
});

export const loadComments = async (): Promise<CommentsDocument> => {
  const response = await fetch("/__sadoku/comments");
  if (!response.ok) {
    throw new Error(`Failed to load comments: ${response.status}`);
  }
  return toCommentsDocument(await response.json() as CommentsDocumentResponse);
};

export const createComment = async (
  startLine: number,
  body: string,
  endLine: number,
): Promise<Comment> => {
  const response = await fetch("/__sadoku/comments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ startLine, endLine, body }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create comment: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const createReply = async (
  commentId: number,
  body: string,
): Promise<Comment> => {
  const response = await fetch(
    `/__sadoku/comments/${encodeURIComponent(commentId)}/replies`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to create reply: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const updateReply = async (
  commentId: number,
  replyId: number,
  body: string,
): Promise<Comment> => {
  const response = await fetch(
    `/__sadoku/comments/${encodeURIComponent(commentId)}/replies/${
      encodeURIComponent(replyId)
    }`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to update reply: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const deleteReply = async (
  commentId: number,
  replyId: number,
): Promise<void> => {
  const response = await fetch(
    `/__sadoku/comments/${encodeURIComponent(commentId)}/replies/${
      encodeURIComponent(replyId)
    }`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete reply: ${response.status}`);
  }
};

export const updateComment = async (
  id: number,
  body: string,
): Promise<Comment> => {
  const response = await fetch(`/__sadoku/comments/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update comment: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const resolveComment = async (id: number): Promise<Comment> => {
  const response = await fetch(
    `/__sadoku/comments/${encodeURIComponent(id)}/resolve`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to resolve comment: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const reopenComment = async (id: number): Promise<Comment> => {
  const response = await fetch(
    `/__sadoku/comments/${encodeURIComponent(id)}/reopen`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to reopen comment: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const deleteComment = async (id: number): Promise<void> => {
  const response = await fetch(`/__sadoku/comments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete comment: ${response.status}`);
  }
};
