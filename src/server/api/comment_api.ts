import type { PreviewSource } from "../source.ts";
import type { DirectorySession } from "../usecase/document/types.ts";
import type { RunGitHubCommand } from "../github_pull.ts";
import { createGitHubCommentExporter } from "../github_comment.ts";
import {
  type CommentExportError,
  exportComment,
} from "../usecase/comment/export_comment.ts";
import { readMarkdownSource } from "../source.ts";
import { readResolvedCommentsDocument } from "../usecase/comment/position.ts";
import {
  type CommentsStore,
  fileCommentsStore,
} from "../storage/comment/storage.ts";
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

const dependencies = (
  commentsStore: CommentsStore,
  source: PreviewSource,
  readMarkdown = readMarkdownSource,
): CommentsDependencies => ({
  commentsStore,
  readMarkdown: async (markdownSource) => {
    try {
      return await readMarkdown(markdownSource);
    } catch (error) {
      if (markdownSource !== source.documentSource) throw error;
      const snapshot = (await commentsStore.read(source.commentSource))
        .sourceSnapshot;
      if (snapshot === undefined) throw error;
      return snapshot;
    }
  },
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
  const { previousSourceSnapshot: _, sourceSnapshot: __, ...document } =
    await readResolvedCommentsDocument(
      source.commentSource,
      source.documentSource,
      commentsStore,
      dependencies(commentsStore, source, readMarkdown).readMarkdown,
    );
  return noStoreJson({
    ...document,
    ...(githubHeadSha ? { githubHeadSha } : {}),
  });
};

const exportErrors = {
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
  code: keyof typeof exportErrors,
  status = exportErrors[code],
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
  const pull = session.githubPull;
  if (!pull) return githubExportErrorResponse("export_unavailable");
  const document = session.documentsById.get(documentId);
  if (!document) return githubExportErrorResponse("export_document_not_found");
  const pullUrl =
    `https://github.com/${pull.owner}/${pull.repo}/pull/${pull.pullNumber}`;
  // Read the immutable head document remotely once for this operation. Never
  // substitute a saved snapshot when checking what the user is viewing.
  let remoteMarkdown: Promise<string> | undefined;
  const readMarkdown = () =>
    remoteMarkdown ??= (session.readMarkdown ?? readMarkdownSource)(
      source.documentSource,
    );
  try {
    return noStoreJson(
      await exportComment({
        readMarkdown,
        readTarget: () => {
          const current = session.documentsById.get(documentId);
          return current && !current.deleted
            ? {
              path: current.relativePath,
              headSha: new URL(current.filePath).searchParams.get("ref") ?? "",
            }
            : undefined;
        },
        readComment: async () => {
          const comments = await readResolvedCommentsDocument(
            source.commentSource,
            source.documentSource,
            store,
            readMarkdown,
          );
          return comments.comments.find((comment) => comment.id === commentId);
        },
        exporter: createGitHubCommentExporter({ ...pull, url: pullUrl }, run),
        key: async (comment) => {
          const bytes = new TextEncoder().encode(JSON.stringify([
            pullUrl,
            document.relativePath,
            comment.id,
            comment.createdAt,
          ]));
          return [
            ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          ]
            .map((byte) => byte.toString(16).padStart(2, "0")).join("");
        },
      }, {
        startLine,
        endLine,
        body,
        displayedMarkdown,
        headSha,
        commentId,
        createdAt,
        path: document.relativePath,
      }),
    );
  } catch (error) {
    if (
      typeof error === "object" && error !== null && "type" in error &&
      Object.hasOwn(exportErrors, String(error.type))
    ) {
      return githubExportErrorResponse(error.type as keyof typeof exportErrors);
    }
    return githubExportErrorResponse("export_failed");
  }
};
