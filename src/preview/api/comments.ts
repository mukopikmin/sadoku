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
  reviewRequested?: boolean;
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
  resolvedBy?: CommentAuthorResponse;
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
  ...(response.reviewRequested === true ? { reviewRequested: true } : {}),
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
      resolvedBy: response.resolvedBy,
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

const commentsUrl = (documentId?: number) =>
  documentId === undefined
    ? "/__sadoku/comments"
    : `/__sadoku/documents/${encodeURIComponent(documentId)}/comments`;

export const loadComments = async (
  documentId?: number,
): Promise<CommentsDocument> => {
  const response = await fetch(commentsUrl(documentId));
  if (!response.ok) {
    throw new Error(`Failed to load comments: ${response.status}`);
  }
  return toCommentsDocument(await response.json() as CommentsDocumentResponse);
};

export const createComment = async (
  startLine: number,
  body: string,
  endLine: number,
  documentId?: number,
): Promise<Comment> => {
  const response = await fetch(commentsUrl(documentId), {
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
  documentId?: number,
): Promise<Comment> => {
  const response = await fetch(
    `${commentsUrl(documentId)}/${encodeURIComponent(commentId)}/replies`,
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
  documentId?: number,
): Promise<Comment> => {
  const response = await fetch(
    `${commentsUrl(documentId)}/${encodeURIComponent(commentId)}/replies/${
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
  documentId?: number,
): Promise<void> => {
  const response = await fetch(
    `${commentsUrl(documentId)}/${encodeURIComponent(commentId)}/replies/${
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
  documentId?: number,
): Promise<Comment> => {
  const response = await fetch(
    `${commentsUrl(documentId)}/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to update comment: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const resolveComment = async (
  id: number,
  documentId?: number,
): Promise<Comment> => {
  const response = await fetch(
    `${commentsUrl(documentId)}/${encodeURIComponent(id)}/resolve`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to resolve comment: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const reopenComment = async (
  id: number,
  documentId?: number,
): Promise<Comment> => {
  const response = await fetch(
    `${commentsUrl(documentId)}/${encodeURIComponent(id)}/reopen`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to reopen comment: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const deleteComment = async (
  id: number,
  documentId?: number,
): Promise<void> => {
  const response = await fetch(
    `${commentsUrl(documentId)}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete comment: ${response.status}`);
  }
};
