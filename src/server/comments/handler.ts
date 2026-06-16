import type { PreviewComment, PreviewCommentReply } from "./types.ts";
import {
  getLineRangeText,
  hashSourceText,
  readResolvedCommentsDocument,
  resolveCommentPosition,
} from "./position.ts";
import { readCommentsDocument, writeCommentsDocument } from "./storage.ts";
import {
  methodNotAllowedResponse,
  noStoreJson,
  notFoundResponse,
  textResponse,
} from "../responses.ts";

export type { PreviewComment, PreviewCommentsDocument } from "./types.ts";

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
): { endLine: number; line: number } => {
  if (typeof value !== "object" || value === null) {
    throw textResponse("Comment line is required.", 400);
  }
  const { endLine: rawEndLine, line: rawLine } = value as {
    endLine?: unknown;
    line?: unknown;
  };
  const line = parsePositiveInteger(rawLine, "Comment line");
  const endLine = rawEndLine === undefined
    ? line
    : parsePositiveInteger(rawEndLine, "Comment endLine");
  if (line > endLine) {
    throw textResponse(
      "Comment line must be less than or equal to endLine.",
      400,
    );
  }
  return { endLine, line };
};

const createCommentResponse = (comment: PreviewComment): Response =>
  noStoreJson(comment);

const createCommentNotFoundResponse = (): Response =>
  notFoundResponse("Comment not found.");

const parseCommentRoute = (
  pathname: string,
  commentsPath: string,
): { action?: string; commentId: string } | undefined => {
  if (!pathname.startsWith(`${commentsPath}/`)) return undefined;

  const id = decodeURIComponent(pathname.slice(`${commentsPath}/`.length));
  if (id === "") return { commentId: "" };

  const actionSeparator = id.indexOf("/");
  return {
    action: actionSeparator === -1 ? undefined : id.slice(actionSeparator + 1),
    commentId: actionSeparator === -1 ? id : id.slice(0, actionSeparator),
  };
};

const createComment = async (
  request: Request,
  filePath: string,
): Promise<Response> => {
  const body = await parseJsonBody(request);
  const { endLine, line } = parseCommentRange(body);
  const commentBody = parseCommentBody(body);
  const markdown = await Deno.readTextFile(filePath);
  const sourceText = getLineRangeText(markdown, line, endLine);
  if (sourceText === undefined) {
    throw textResponse("Comment range does not exist.", 400);
  }
  const now = new Date().toISOString();
  const comment: PreviewComment = {
    body: commentBody,
    createdAt: now,
    id: crypto.randomUUID(),
    line,
    endLine,
    originalLine: line,
    originalEndLine: endLine,
    replies: [],
    resolved: false,
    sourceHash: hashSourceText(sourceText),
    sourceText,
    stale: false,
    updatedAt: now,
  };
  const document = await readCommentsDocument(filePath);
  const updatedDocument = {
    comments: [...document.comments, comment],
    filePath,
  };
  await writeCommentsDocument(filePath, updatedDocument);
  return createCommentResponse(comment);
};

const createReply = async (
  request: Request,
  filePath: string,
  commentId: string,
): Promise<Response> => {
  const document = await readCommentsDocument(filePath);
  const index = document.comments.findIndex((comment) =>
    comment.id === commentId
  );
  if (index < 0) return createCommentNotFoundResponse();

  const body = await parseJsonBody(request);
  const replyBody = parseCommentBody(body);
  const now = new Date().toISOString();
  const reply: PreviewCommentReply = {
    body: replyBody,
    createdAt: now,
    id: crypto.randomUUID(),
    updatedAt: now,
  };
  const updatedComment = {
    ...document.comments[index],
    replies: [...(document.comments[index].replies ?? []), reply],
    updatedAt: now,
  };
  const comments = [...document.comments];
  comments[index] = updatedComment;
  await writeCommentsDocument(filePath, { comments, filePath });
  return createCommentResponse(
    resolveCommentPosition(updatedComment, await Deno.readTextFile(filePath)),
  );
};

const setCommentResolution = async (
  filePath: string,
  commentId: string,
  resolved: boolean,
): Promise<Response> => {
  const document = await readCommentsDocument(filePath);
  const index = document.comments.findIndex((comment) =>
    comment.id === commentId
  );
  if (index < 0) return createCommentNotFoundResponse();
  const now = new Date().toISOString();
  const updatedComment = {
    ...document.comments[index],
    resolved,
    resolvedAt: resolved ? now : undefined,
    updatedAt: now,
  };
  const comments = [...document.comments];
  comments[index] = updatedComment;
  await writeCommentsDocument(filePath, { comments, filePath });
  return createCommentResponse(
    resolveCommentPosition(updatedComment, await Deno.readTextFile(filePath)),
  );
};

const updateComment = async (
  request: Request,
  filePath: string,
  commentId: string,
): Promise<Response> => {
  const body = await parseJsonBody(request);
  const commentBody = parseCommentBody(body);
  const document = await readCommentsDocument(filePath);
  const index = document.comments.findIndex((comment) =>
    comment.id === commentId
  );
  if (index < 0) return createCommentNotFoundResponse();
  const updatedComment = {
    ...document.comments[index],
    body: commentBody,
    updatedAt: new Date().toISOString(),
  };
  const comments = [...document.comments];
  comments[index] = updatedComment;
  await writeCommentsDocument(filePath, { comments, filePath });
  return createCommentResponse(
    resolveCommentPosition(updatedComment, await Deno.readTextFile(filePath)),
  );
};

const deleteComment = async (
  filePath: string,
  commentId: string,
): Promise<Response> => {
  const document = await readCommentsDocument(filePath);
  const comments = document.comments.filter((comment) =>
    comment.id !== commentId
  );
  if (comments.length === document.comments.length) {
    return createCommentNotFoundResponse();
  }
  await writeCommentsDocument(filePath, { comments, filePath });
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
};

export const handleCommentsRequest = async (
  request: Request,
  filePath: string,
  pathname: string,
): Promise<Response> => {
  const commentsPath = "/__mdview/comments";
  if (pathname === commentsPath && request.method === "GET") {
    return noStoreJson(await readResolvedCommentsDocument(filePath));
  }

  if (pathname === commentsPath && request.method === "POST") {
    return await createComment(request, filePath);
  }

  const route = parseCommentRoute(pathname, commentsPath);
  if (!route) return notFoundResponse();
  if (route.commentId === "") return createCommentNotFoundResponse();

  if (
    request.method === "POST" &&
    (route.action === "resolve" || route.action === "reopen")
  ) {
    return await setCommentResolution(
      filePath,
      route.commentId,
      route.action === "resolve",
    );
  }

  if (request.method === "POST" && route.action === "replies") {
    return await createReply(request, filePath, route.commentId);
  }

  if (route.action !== undefined) return notFoundResponse();
  if (request.method === "PUT") {
    return await updateComment(request, filePath, route.commentId);
  }
  if (request.method === "DELETE") {
    return await deleteComment(filePath, route.commentId);
  }

  return methodNotAllowedResponse();
};
