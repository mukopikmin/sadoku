import { readConfig } from "../config.ts";
import {
  type ConfiguredCommentsStore,
  createConfiguredCommentsStore,
} from "../server/comments/factory.ts";
import type {
  CommentsStore,
  CommentsStoreFile,
} from "../server/comments/storage.ts";
import {
  getLineRangeText,
  hashSourceText,
  readResolvedCommentsDocument,
  resolveCommentPosition,
} from "../server/comments/position.ts";
import type {
  PreviewComment,
  PreviewCommentReply,
  PreviewCommentsDocument,
} from "../server/comments/types.ts";
import { createPreviewSource, readMarkdownSource } from "../server/source.ts";

export type ListCommentFilesResult = {
  entries: ListedCommentFile[];
  warnings: string[];
};

export type ListedCommentFile = CommentsStoreFile;

export type CommentsCliOptions = {
  asBot?: boolean;
  commentsStore?: CommentsStore;
};

const withCommentsStore = async <T>(
  options: CommentsCliOptions,
  operation: (commentsStore: CommentsStore) => Promise<T>,
): Promise<T> => {
  const commentsStore = options.commentsStore ??
    await createConfiguredCommentsStore(readConfig());
  try {
    return await operation(commentsStore);
  } finally {
    if (options.commentsStore === undefined) {
      (commentsStore as ConfiguredCommentsStore).close?.();
    }
  }
};

export const listCommentFiles = async (
  options: CommentsCliOptions = {},
): Promise<ListCommentFilesResult> =>
  await withCommentsStore(options, (commentsStore) => commentsStore.list());

const pad = (value: string, width: number): string => value.padEnd(width, " ");

export const formatCommentFilesTable = (
  entries: ListedCommentFile[],
): string => {
  if (entries.length === 0) return "No comment files found.\n";

  const rows = entries.map((entry) => [
    entry.fileName,
    entry.markdownPath || "-",
    entry.commentCount.toString(),
    entry.openCount.toString(),
    entry.updatedAt ?? "-",
  ]);
  const headers = ["FILE", "MARKDOWN PATH", "COMMENTS", "OPEN", "UPDATED"];
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index].length))
  );
  const formatRow = (row: string[]): string =>
    row.map((value, index) => pad(value, widths[index])).join("  ").trimEnd();

  return `${formatRow(headers)}\n${rows.map(formatRow).join("\n")}\n`;
};

export const shouldRemoveComments = (answer: string): boolean =>
  ["y", "yes"].includes(answer.trim().toLowerCase());

export const inspectComments = async (
  filePath: string,
  options: CommentsCliOptions = {},
): Promise<PreviewCommentsDocument> => {
  const source = createPreviewSource(filePath);
  return await withCommentsStore(options, async (commentsStore) => {
    const document = await readResolvedCommentsDocument(
      source.commentSource,
      source.documentSource,
      commentsStore,
    );
    return {
      comments: document.comments.filter((comment) => !comment.resolved),
      filePath: source.commentSource,
    };
  });
};

export const addComment = async (
  filePath: string,
  startLine: number,
  endLine: number,
  body: string,
  options: CommentsCliOptions = {},
): Promise<PreviewComment> => {
  const commentBody = body.trim();
  if (commentBody === "") throw new Error("Comment body is required.");

  const source = createPreviewSource(filePath);
  return await withCommentsStore(options, async (commentsStore) => {
    const markdown = await readMarkdownSource(source.documentSource);
    const sourceText = getLineRangeText(markdown, startLine, endLine);
    if (sourceText === undefined) {
      throw new Error("Comment range does not exist.");
    }
    const document = await commentsStore.read(source.commentSource);
    const now = new Date().toISOString();
    const comment: PreviewComment = {
      author: { type: options.asBot ? "bot" : "human" },
      body: commentBody,
      createdAt: now,
      endLine,
      id: Math.max(0, ...document.comments.map((comment) => comment.id)) + 1,
      originalEndLine: endLine,
      originalStartLine: startLine,
      replies: [],
      resolved: false,
      sourceHash: hashSourceText(sourceText),
      sourceText,
      stale: false,
      startLine,
      updatedAt: now,
    };
    await commentsStore.write(source.commentSource, {
      comments: [...document.comments, comment],
      filePath: source.commentSource,
    });
    return comment;
  });
};

export const resolveComments = async (
  filePath: string,
  commentIds: string[],
  options: CommentsCliOptions = {},
): Promise<PreviewCommentsDocument> => {
  if (commentIds.length === 0) {
    throw new Error("At least one comment ID is required.");
  }

  const source = createPreviewSource(filePath);
  return await withCommentsStore(options, async (commentsStore) => {
    const document = await commentsStore.read(source.commentSource);
    const requestedIdEntries = commentIds.map((id) => ({
      input: id,
      value: Number(id),
    }));
    const requestedIds = new Set(
      requestedIdEntries.map((entry) => entry.value),
    );
    const knownIds = new Set(document.comments.map((comment) => comment.id));
    const missingIds = requestedIdEntries
      .filter((entry) =>
        Number.isNaN(entry.value) || !knownIds.has(entry.value)
      )
      .map((entry) => entry.input);
    if (missingIds.length > 0) {
      throw new Error(`Comment not found: ${missingIds.join(", ")}`);
    }

    const now = new Date().toISOString();
    const updatedDocument: PreviewCommentsDocument = {
      comments: document.comments.map((comment) =>
        requestedIds.has(comment.id)
          ? {
            ...comment,
            resolved: true,
            resolvedAt: now,
            resolvedBy: { type: options.asBot ? "bot" : "human" },
            updatedAt: now,
          }
          : comment
      ),
      filePath: source.commentSource,
    };
    await commentsStore.write(source.commentSource, updatedDocument);
    return {
      comments: updatedDocument.comments.filter((comment) =>
        requestedIds.has(comment.id)
      ),
      filePath: source.commentSource,
    };
  });
};

export const replyToComment = async (
  filePath: string,
  commentId: string,
  body: string,
  options: CommentsCliOptions = {},
): Promise<PreviewComment> => {
  const replyBody = body.trim();
  if (replyBody === "") {
    throw new Error("Reply body is required.");
  }

  const source = createPreviewSource(filePath);
  return await withCommentsStore(options, async (commentsStore) => {
    const document = await commentsStore.read(source.commentSource);
    const parsedCommentId = Number(commentId);
    const index = document.comments.findIndex((comment) =>
      comment.id === parsedCommentId
    );
    if (index < 0) {
      throw new Error(`Comment not found: ${commentId}`);
    }

    const now = new Date().toISOString();
    const reply: PreviewCommentReply = {
      author: { type: options.asBot ? "bot" : "human" },
      body: replyBody,
      createdAt: now,
      id: Math.max(
        0,
        ...(document.comments[index].replies ?? []).map((reply) => reply.id),
      ) + 1,
      updatedAt: now,
    };
    const updatedComment = {
      ...document.comments[index],
      replies: [...(document.comments[index].replies ?? []), reply],
      updatedAt: now,
    };
    const comments = [...document.comments];
    comments[index] = updatedComment;
    await commentsStore.write(source.commentSource, {
      comments,
      filePath: source.commentSource,
    });
    return resolveCommentPosition(
      updatedComment,
      await readMarkdownSource(source.documentSource),
    );
  });
};

export const removeComments = async (
  filePath: string,
  options: CommentsCliOptions = {},
): Promise<string> => {
  const source = createPreviewSource(filePath);
  if (!source.isRemote) {
    const fileInfo = await Deno.stat(source.documentSource).catch((error) => {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`Markdown file not found: ${source.documentSource}`);
      }
      throw error;
    });
    if (!fileInfo.isFile) {
      throw new Error(`Markdown path is not a file: ${source.documentSource}`);
    }
  }

  await withCommentsStore(
    options,
    async (commentsStore) =>
      await commentsStore.delete(source.commentSource).catch((error) => {
        if (error instanceof Deno.errors.NotFound) {
          const sourceType = source.isRemote
            ? "Markdown source"
            : "Markdown file";
          throw new Error(
            `Comments not found for ${sourceType}: ${source.commentSource}`,
          );
        }
        throw error;
      }),
  );
  return source.commentSource;
};

export const removeCommentsIfConfirmed = async (
  filePath: string,
  answer: string,
  options: CommentsCliOptions = {},
): Promise<string | undefined> =>
  shouldRemoveComments(answer)
    ? await removeComments(filePath, options)
    : undefined;
