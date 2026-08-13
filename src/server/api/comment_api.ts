import type { PreviewSource } from "../source.ts";
import { readMarkdownSource } from "../source.ts";
import { readResolvedCommentsDocument } from "../comments/position.ts";
import { type CommentsStore, fileCommentsStore } from "../comments/storage.ts";
import { noStoreJson, textResponse } from "../responses.ts";
import type { CommentsDependencies } from "../usecase/comment/ports.ts";
import {
  commentsErrorMessage,
  isCommentsUseCaseError,
} from "../usecase/comment/errors.ts";
import {
  addComment,
  addReply,
  deleteComment as deleteCommentUseCase,
  deleteReply as deleteReplyUseCase,
  setCommentResolution as setResolutionUseCase,
  updateComment as updateCommentUseCase,
  updateReply as updateReplyUseCase,
} from "../usecase/comment/mod.ts";

export type {
  PreviewComment,
  PreviewCommentsDocument,
} from "../comments/types.ts";

const parseJsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    throw textResponse("Invalid JSON body.", 400);
  }
};

const parseCommentBody = (value: unknown): string => {
  if (typeof value !== "object" || value === null) {
    throw textResponse("Comment body is required.", 400);
  }
  const body = (value as { body?: unknown }).body;
  if (typeof body !== "string" || body.trim() === "") {
    throw textResponse("Comment body is required.", 400);
  }
  return body.trim();
};

const parsePositiveInteger = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw textResponse(`${name} must be a positive integer.`, 400);
  }
  return value;
};

const parseCommentRange = (
  value: unknown,
): { endLine: number; startLine: number } => {
  if (typeof value !== "object" || value === null) {
    throw textResponse("Comment range is required.", 400);
  }
  const { endLine: rawEndLine, startLine: rawStartLine } = value as {
    endLine?: unknown;
    startLine?: unknown;
  };
  const startLine = parsePositiveInteger(rawStartLine, "Comment startLine");
  const endLine = parsePositiveInteger(rawEndLine, "Comment endLine");
  if (endLine < startLine) {
    throw textResponse(
      "Comment endLine must be greater than or equal to startLine.",
      400,
    );
  }
  return { endLine, startLine };
};

const dependencies = (commentsStore: CommentsStore): CommentsDependencies => ({
  commentsStore,
  readMarkdown: readMarkdownSource,
  now: () => new Date().toISOString(),
});

const mapUseCaseError = (error: unknown): Response => {
  if (!isCommentsUseCaseError(error)) throw error;
  const status =
    error.type === "comment_not_found" || error.type === "reply_not_found"
      ? 404
      : 400;
  const message = error.type === "comment_not_found"
    ? "Comment not found."
    : error.type === "reply_not_found"
    ? "Reply not found."
    : commentsErrorMessage(error);
  return textResponse(message, status);
};

const respond = async <T>(operation: () => Promise<T>): Promise<Response> => {
  try {
    return noStoreJson(await operation());
  } catch (error) {
    return mapUseCaseError(error);
  }
};
const empty = async (operation: () => Promise<void>): Promise<Response> => {
  try {
    await operation();
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return mapUseCaseError(error);
  }
};

export const createComment = async (
  request: Request,
  source: PreviewSource,
  store: CommentsStore,
): Promise<Response> => {
  const value = await parseJsonBody(request);
  const range = parseCommentRange(value);
  const body = parseCommentBody(value);
  return await respond(() =>
    addComment(dependencies(store), source, { ...range, body })
  );
};
export const createReply = async (
  request: Request,
  source: PreviewSource,
  store: CommentsStore,
  commentId: number,
): Promise<Response> => {
  const body = parseCommentBody(await parseJsonBody(request));
  return await respond(() =>
    addReply(dependencies(store), source, { commentId, body })
  );
};
export const updateReply = async (
  request: Request,
  source: PreviewSource,
  store: CommentsStore,
  commentId: number,
  replyId: number,
): Promise<Response> => {
  const body = parseCommentBody(await parseJsonBody(request));
  return await respond(() =>
    updateReplyUseCase(dependencies(store), source, {
      commentId,
      replyId,
      body,
    })
  );
};
export const deleteReply = (
  source: PreviewSource,
  store: CommentsStore,
  commentId: number,
  replyId: number,
): Promise<Response> =>
  empty(() =>
    deleteReplyUseCase(dependencies(store), source, commentId, replyId)
  );
export const setCommentResolution = (
  source: PreviewSource,
  store: CommentsStore,
  commentId: number,
  resolved: boolean,
): Promise<Response> =>
  respond(() =>
    setResolutionUseCase(dependencies(store), source, commentId, resolved)
  );
export const updateComment = async (
  request: Request,
  source: PreviewSource,
  store: CommentsStore,
  commentId: number,
): Promise<Response> => {
  const body = parseCommentBody(await parseJsonBody(request));
  return await respond(() =>
    updateCommentUseCase(dependencies(store), source, commentId, body)
  );
};
export const deleteComment = (
  source: PreviewSource,
  store: CommentsStore,
  commentId: number,
): Promise<Response> =>
  empty(() => deleteCommentUseCase(dependencies(store), source, commentId));
export const getComments = async (
  source: PreviewSource,
  commentsStore: CommentsStore = fileCommentsStore,
): Promise<Response> => {
  const { previousSourceSnapshot: _, sourceSnapshot: __, ...document } =
    await readResolvedCommentsDocument(
      source.commentSource,
      source.documentSource,
      commentsStore,
    );
  return noStoreJson(document);
};
