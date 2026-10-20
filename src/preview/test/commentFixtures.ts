import type { CommentActions } from "../api/commentActions";
import type { Comment, CommentReply } from "../models/comment";

export const createCommentActions = (
  overrides: Partial<CommentActions> = {},
): CommentActions => ({
  onCreateComment: async () => {},
  onDeleteComment: async () => {},
  onDeleteReply: async () => {},
  onReopenComment: async () => {},
  onReplyComment: async () => {},
  onResolveComment: async () => {},
  onUpdateComment: async () => {},
  onUpdateReply: async () => {},
  ...overrides,
});

export const createComment = (
  overrides: Partial<Comment> = {},
): Comment => ({
  author: { type: "human" },
  body: "Clarify this.",
  createdAt: "2026-06-05T00:00:00.000Z",
  endLine: 3,
  id: 1,
  originalEndLine: 3,
  originalStartLine: 3,
  sourceHash: "example",
  sourceText: "Body",
  startLine: 3,
  state: "active",
  updatedAt: "2026-06-05T00:00:00.000Z",
  ...overrides,
});

export const createCommentReply = (
  overrides: Partial<CommentReply> = {},
): CommentReply => ({
  author: { type: "human" },
  body: "Reply body.",
  createdAt: "2026-06-05T01:00:00.000Z",
  id: 1,
  updatedAt: "2026-06-05T01:00:00.000Z",
  ...overrides,
});
