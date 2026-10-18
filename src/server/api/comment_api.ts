import { exportPreviewComment } from "../preview/export_comment.ts";
import { readPreviewComments } from "../usecase/comment/read_preview_comments.ts";
import type { PreviewSource } from "../source.ts";
import type { DirectorySession } from "../usecase/document/types.ts";
import type { RunGitHubCommand } from "../github_pull.ts";
import type { CommentExportError } from "../usecase/comment/export_comment.ts";
import {
  type CommentsStore,
  fileCommentsStore,
} from "../storage/comment/storage.ts";
import { noStoreJson, textResponse } from "../responses.ts";
import { createCommentsDependencies as dependencies } from "../comment_dependencies.ts";
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
} from "../usecase/comment/types.ts";

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
  readMarkdown?: (source: string) => Promise<string>,
): Promise<Response> => {
  const value = await parseJsonBody(request);
  const range = parseCommentRange(value);
  const body = parseCommentBody(value);
  return await respond(() =>
    addComment(dependencies(store, source, readMarkdown), source, {
      ...range,
      body,
    })
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
    addReply(dependencies(store, source), source, { commentId, body })
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
    updateReplyUseCase(dependencies(store, source), source, {
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
    deleteReplyUseCase(dependencies(store, source), source, commentId, replyId)
  );
export const setCommentResolution = (
  source: PreviewSource,
  store: CommentsStore,
  commentId: number,
  resolved: boolean,
): Promise<Response> =>
  respond(() =>
    setResolutionUseCase(
      dependencies(store, source),
      source,
      commentId,
      resolved,
    )
  );
export const updateComment = async (
  request: Request,
  source: PreviewSource,
  store: CommentsStore,
  commentId: number,
): Promise<Response> => {
  const body = parseCommentBody(await parseJsonBody(request));
  return await respond(() =>
    updateCommentUseCase(dependencies(store, source), source, commentId, body)
  );
};
export const deleteComment = (
  source: PreviewSource,
  store: CommentsStore,
  commentId: number,
): Promise<Response> =>
  empty(() =>
    deleteCommentUseCase(dependencies(store, source), source, commentId)
  );
export const getComments = async (
  source: PreviewSource,
  commentsStore: CommentsStore = fileCommentsStore,
  readMarkdown?: (source: string) => Promise<string>,
  githubHeadSha?: string,
): Promise<Response> => {
  return noStoreJson(
    await readPreviewComments(
      dependencies(commentsStore, source, readMarkdown),
      source,
      githubHeadSha,
    ),
  );
};

export const githubExportErrors = {
  export_review_out_of_sync: 409,
  export_markdown_changed: 409,
  export_unavailable: 409,
  export_out_of_sync: 409,
  export_comment_not_found: 404,
  export_comment_ineligible: 409,
  export_outside_diff: 409,
  export_busy: 409,
  export_json_required: 415,
  export_invalid_request: 400,
  export_document_not_found: 404,
  export_failed: 502,
} satisfies Record<CommentExportError["type"], number> & Record<string, number>;

export const githubExportErrorResponse = (
  code: keyof typeof githubExportErrors,
  status = githubExportErrors[code],
): Response => noStoreJson({ error: { code } }, status);

const parseExportRequest = async (request: Request) => {
  const value: unknown = await request.json();
  const range = parseCommentRange(value);
  const body = parseCommentBody(value);
  return { ...value as Record<string, unknown>, ...range, body };
};

export const exportCommentToGitHub = async (
  request: Request,
  session: DirectorySession,
  documentId: number,
  commentId: number,
  source: PreviewSource,
  store: CommentsStore,
  run: RunGitHubCommand,
): Promise<Response> => {
  // JSON-only requests also prevent cross-origin HTML forms from posting.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return githubExportErrorResponse("export_json_required");
  }
  let value;
  try {
    value = await parseExportRequest(request);
  } catch {
    return githubExportErrorResponse("export_invalid_request");
  }
  const { startLine, endLine, body } = value;
  const headSha = (value as { headSha?: unknown }).headSha;
  const displayedMarkdown =
    (value as { displayedMarkdown?: unknown }).displayedMarkdown;
  if (typeof displayedMarkdown !== "string") {
    return githubExportErrorResponse("export_invalid_request");
  }
  const createdAt = (value as { createdAt?: unknown }).createdAt;
  if (typeof createdAt !== "string" || !createdAt) {
    return githubExportErrorResponse("export_invalid_request");
  }
  if (typeof headSha !== "string" || !/^[a-f0-9]{40,64}$/.test(headSha)) {
    return githubExportErrorResponse("export_invalid_request");
  }
  try {
    return noStoreJson(
      await exportPreviewComment(
        { startLine, endLine, body, displayedMarkdown, headSha, createdAt },
        session,
        documentId,
        commentId,
        source,
        store,
        run,
      ),
    );
  } catch (error) {
    if (
      typeof error === "object" && error !== null && "type" in error &&
      Object.hasOwn(githubExportErrors, String(error.type))
    ) {
      return githubExportErrorResponse(
        error.type as keyof typeof githubExportErrors,
      );
    }
    return githubExportErrorResponse("export_failed");
  }
};
