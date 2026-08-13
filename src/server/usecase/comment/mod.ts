import type {
  CommentAuthor,
  PreviewComment,
  PreviewCommentReply,
  PreviewCommentsDocument,
} from "./types.ts";
import type { CommentsDependencies } from "./ports.ts";
import { throwCommentsError } from "./errors.ts";

export type CommentSource = { commentSource: string; documentSource: string };

const nextId = (ids: number[]): number => Math.max(0, ...ids) + 1;
const rangeText = (markdown: string, startLine: number, endLine: number) => {
  if (startLine < 1 || endLine < startLine) return undefined;
  const lines = markdown.split("\n");
  return endLine > lines.length
    ? undefined
    : lines.slice(startLine - 1, endLine).join("\n");
};
const hash = (value: string): string => {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
};
const body = (value: string, subject: "comment" | "reply") => {
  const trimmed = value.trim();
  return trimmed || throwCommentsError({ type: "body_required", subject });
};
const findComment = (document: PreviewCommentsDocument, id: number) => {
  const index = document.comments.findIndex((comment) => comment.id === id);
  if (index < 0) {
    throwCommentsError({ type: "comment_not_found", commentId: id });
  }
  return index;
};
const saveComment = async (
  deps: CommentsDependencies,
  source: CommentSource,
  document: PreviewCommentsDocument,
  index: number,
  comment: PreviewComment,
) => {
  const comments = [...document.comments];
  comments[index] = comment;
  await deps.commentsStore.write(source.commentSource, {
    ...document,
    comments,
    filePath: source.commentSource,
  });
  return comment;
};

export const listComments = (deps: CommentsDependencies) =>
  deps.commentsStore.list();

export const getComments = async (
  deps: CommentsDependencies,
  source: CommentSource,
): Promise<PreviewCommentsDocument> =>
  await deps.commentsStore.read(source.commentSource);

export const addComment = async (
  deps: CommentsDependencies,
  source: CommentSource,
  input: {
    startLine: number;
    endLine: number;
    body: string;
    author?: CommentAuthor;
  },
): Promise<PreviewComment> => {
  const markdown = await deps.readMarkdown(source.documentSource);
  const sourceText = rangeText(markdown, input.startLine, input.endLine);
  if (sourceText === undefined) {
    return throwCommentsError({
      type: "invalid_range",
      startLine: input.startLine,
      endLine: input.endLine,
    });
  }
  const document = await deps.commentsStore.read(source.commentSource);
  const now = deps.now();
  const comment: PreviewComment = {
    author: input.author ?? { type: "human" },
    body: body(input.body, "comment"),
    createdAt: now,
    updatedAt: now,
    id: nextId(document.comments.map((item) => item.id)),
    startLine: input.startLine,
    endLine: input.endLine,
    originalStartLine: input.startLine,
    originalEndLine: input.endLine,
    replies: [],
    resolved: false,
    stale: false,
    sourceText,
    sourceHash: hash(sourceText),
  };
  await deps.commentsStore.write(source.commentSource, {
    ...document,
    comments: [...document.comments, comment],
    filePath: source.commentSource,
    sourceSnapshot: markdown,
  });
  return comment;
};

export const addReply = async (
  deps: CommentsDependencies,
  source: CommentSource,
  input: {
    commentId: number;
    body: string;
    author?: CommentAuthor;
    requestReview?: boolean;
  },
) => {
  const document = await deps.commentsStore.read(source.commentSource);
  const index = findComment(document, input.commentId);
  const author = input.author ?? { type: "human" as const };
  if (input.requestReview && author.type !== "bot") {
    throwCommentsError({ type: "review_requires_bot" });
  }
  if (input.requestReview && document.comments[index].resolved) {
    throwCommentsError({
      type: "review_on_resolved_comment",
      commentId: input.commentId,
    });
  }
  const now = deps.now();
  const replies = document.comments[index].replies ?? [];
  const reply: PreviewCommentReply = {
    author,
    body: body(input.body, "reply"),
    createdAt: now,
    id: nextId(replies.map((item) => item.id)),
    updatedAt: now,
    ...(input.requestReview ? { reviewRequested: true } : {}),
  };
  return await saveComment(deps, source, document, index, {
    ...document.comments[index],
    replies: [...replies, reply],
    updatedAt: now,
  });
};

export const updateReply = async (
  deps: CommentsDependencies,
  source: CommentSource,
  input: { commentId: number; replyId: number; body: string },
) => {
  const document = await deps.commentsStore.read(source.commentSource);
  const index = findComment(document, input.commentId);
  const replies = [...(document.comments[index].replies ?? [])];
  const replyIndex = replies.findIndex((reply) => reply.id === input.replyId);
  if (replyIndex < 0) {
    throwCommentsError({
      type: "reply_not_found",
      commentId: input.commentId,
      replyId: input.replyId,
    });
  }
  const now = deps.now();
  replies[replyIndex] = {
    ...replies[replyIndex],
    body: body(input.body, "reply"),
    updatedAt: now,
  };
  return await saveComment(deps, source, document, index, {
    ...document.comments[index],
    replies,
    updatedAt: now,
  });
};

export const deleteReply = async (
  deps: CommentsDependencies,
  source: CommentSource,
  commentId: number,
  replyId: number,
) => {
  const document = await deps.commentsStore.read(source.commentSource);
  const index = findComment(document, commentId);
  const replies = document.comments[index].replies ?? [];
  if (!replies.some((reply) => reply.id === replyId)) {
    throwCommentsError({ type: "reply_not_found", commentId, replyId });
  }
  await saveComment(deps, source, document, index, {
    ...document.comments[index],
    replies: replies.filter((reply) => reply.id !== replyId),
    updatedAt: deps.now(),
  });
};

export const setCommentResolution = async (
  deps: CommentsDependencies,
  source: CommentSource,
  commentId: number,
  resolved: boolean,
  author: CommentAuthor = { type: "human" },
) => {
  const document = await deps.commentsStore.read(source.commentSource);
  const index = findComment(document, commentId);
  const now = deps.now();
  return await saveComment(deps, source, document, index, {
    ...document.comments[index],
    resolved,
    resolvedAt: resolved ? now : undefined,
    resolvedBy: resolved ? author : undefined,
    updatedAt: now,
  });
};

export const setCommentsResolution = async (
  deps: CommentsDependencies,
  source: CommentSource,
  commentIds: Array<number | string>,
  resolved: boolean,
  author: CommentAuthor = { type: "human" },
): Promise<PreviewCommentsDocument> => {
  const document = await deps.commentsStore.read(source.commentSource);
  const requested = commentIds.map((id) => ({ id, value: Number(id) }));
  const known = new Set(document.comments.map((comment) => comment.id));
  const missing = requested.filter((entry) =>
    !Number.isFinite(entry.value) || !known.has(entry.value)
  );
  if (missing.length > 0) {
    throwCommentsError({
      type: "comment_not_found",
      commentId: missing.map((entry) => entry.id).join(", "),
    });
  }
  const ids = new Set(requested.map((entry) => entry.value));
  const now = deps.now();
  const updated = {
    ...document,
    comments: document.comments.map((comment) =>
      ids.has(comment.id)
        ? {
          ...comment,
          resolved,
          resolvedAt: resolved ? now : undefined,
          resolvedBy: resolved ? author : undefined,
          updatedAt: now,
        }
        : comment
    ),
    filePath: source.commentSource,
  };
  await deps.commentsStore.write(source.commentSource, updated);
  return {
    ...updated,
    comments: updated.comments.filter((comment) => ids.has(comment.id)),
  };
};

export const updateComment = async (
  deps: CommentsDependencies,
  source: CommentSource,
  commentId: number,
  value: string,
) => {
  const document = await deps.commentsStore.read(source.commentSource);
  const index = findComment(document, commentId);
  return await saveComment(deps, source, document, index, {
    ...document.comments[index],
    body: body(value, "comment"),
    updatedAt: deps.now(),
  });
};

export const deleteComment = async (
  deps: CommentsDependencies,
  source: CommentSource,
  commentId: number,
) => {
  const document = await deps.commentsStore.read(source.commentSource);
  findComment(document, commentId);
  await deps.commentsStore.write(source.commentSource, {
    ...document,
    comments: document.comments.filter((comment) => comment.id !== commentId),
    filePath: source.commentSource,
  });
};

export const deleteComments = (deps: CommentsDependencies, filePath: string) =>
  deps.commentsStore.delete(filePath);
