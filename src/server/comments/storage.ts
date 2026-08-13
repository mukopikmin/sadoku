import type {
  PreviewComment,
  PreviewCommentReply,
  PreviewCommentsDocument,
} from "./types.ts";
import type {
  CommentsStore,
  CommentsStoreFile,
  CommentsStoreFileList,
} from "../usecase/comment/ports.ts";
export type {
  CommentsStore,
  CommentsStoreFile,
  CommentsStoreFileList,
} from "../usecase/comment/ports.ts";
import { basename, join } from "@std/path";
import {
  getCommentsDirectoryPath,
  getLegacyCommentsDirectoryPath,
} from "../config.ts";

export { getCommentsDirectoryPath } from "../config.ts";

type StoredComment = {
  resolved?: boolean;
  updatedAt: string;
};

type StoredCommentsDocument = {
  comments: StoredComment[];
  filePath: string;
};

const hashFilePath = (filePath: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < filePath.length; index += 1) {
    hash ^= filePath.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const sanitizeFileNamePart = (value: string): string =>
  value.replace(/[^A-Za-z0-9._-]/g, "_") || "markdown";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCommentAuthor = (value: unknown): boolean =>
  isRecord(value) && (value.type === "human" || value.type === "bot");

const normalizeCommentAuthor = (value: unknown): PreviewComment["author"] =>
  isCommentAuthor(value)
    ? { type: (value as PreviewComment["author"]).type }
    : { type: "human" };

export const getLegacyCommentsFilePath = (markdownFilePath: string): string =>
  `${markdownFilePath}.mdview-comments.json`;

const getSadokuSidecarCommentsFilePath = (markdownFilePath: string): string =>
  `${markdownFilePath}.sadoku-comments.json`;

const getCommentsStorageFileName = (markdownFilePath: string): string =>
  `${sanitizeFileNamePart(basename(markdownFilePath))}-${
    hashFilePath(markdownFilePath)
  }.json`;

export const getCommentsFilePath = (markdownFilePath: string): string =>
  join(
    getCommentsDirectoryPath(),
    getCommentsStorageFileName(markdownFilePath),
  );

const getLegacyDirectoryCommentsFilePath = (markdownFilePath: string): string =>
  join(
    getLegacyCommentsDirectoryPath(),
    getCommentsStorageFileName(markdownFilePath),
  );

const createEmptyCommentsDocument = (
  filePath: string,
): PreviewCommentsDocument => ({
  comments: [],
  filePath,
});

const isPreviewComment = (value: unknown): value is PreviewComment => {
  if (typeof value !== "object" || value === null) return false;
  const comment = value as Partial<PreviewComment>;
  const {
    endLine,
    originalEndLine,
    originalStartLine,
    startLine,
  } = comment;
  return (comment.author === undefined || isCommentAuthor(comment.author)) &&
    (comment.resolvedBy === undefined ||
      isCommentAuthor(comment.resolvedBy)) &&
    typeof comment.id === "number" &&
    typeof startLine === "number" &&
    Number.isInteger(startLine) &&
    typeof endLine === "number" &&
    Number.isInteger(endLine) &&
    typeof originalStartLine === "number" &&
    Number.isInteger(originalStartLine) &&
    typeof originalEndLine === "number" &&
    Number.isInteger(originalEndLine) &&
    startLine >= 1 &&
    endLine >= startLine &&
    originalStartLine >= 1 &&
    originalEndLine >= originalStartLine &&
    typeof comment.body === "string" &&
    typeof comment.createdAt === "string" &&
    typeof comment.updatedAt === "string";
};

const isPreviewCommentReply = (
  value: unknown,
): value is PreviewCommentReply => {
  if (typeof value !== "object" || value === null) return false;
  const reply = value as Partial<PreviewCommentReply>;
  return (reply.author === undefined || isCommentAuthor(reply.author)) &&
    (reply.reviewRequested === undefined ||
      typeof reply.reviewRequested === "boolean") &&
    typeof reply.id === "number" &&
    typeof reply.body === "string" &&
    typeof reply.createdAt === "string" &&
    typeof reply.updatedAt === "string";
};

const isStoredComment = (value: unknown): value is StoredComment =>
  isRecord(value) && typeof value.updatedAt === "string";

const parseStoredCommentsDocument = (
  text: string,
): StoredCommentsDocument => {
  const value = JSON.parse(text) as unknown;
  if (!isRecord(value) || !Array.isArray(value.comments)) {
    throw new Error("Invalid comments document.");
  }

  return {
    comments: value.comments.filter(isStoredComment),
    filePath: typeof value.filePath === "string" ? value.filePath : "",
  };
};

const latestUpdatedAt = (
  comments: StoredComment[],
): string | undefined =>
  comments.map((comment) => comment.updatedAt).sort().at(-1);

const normalizePreviewComment = (comment: PreviewComment): PreviewComment => {
  return {
    ...comment,
    author: normalizeCommentAuthor(comment.author),
    replies: Array.isArray(comment.replies)
      ? comment.replies.filter(isPreviewCommentReply).map((reply) => ({
        ...reply,
        author: normalizeCommentAuthor(reply.author),
      }))
      : [],
    resolved: comment.resolved === true,
    ...(comment.resolvedBy === undefined
      ? {}
      : { resolvedBy: normalizeCommentAuthor(comment.resolvedBy) }),
  };
};

export const readCommentsDocument = async (
  filePath: string,
): Promise<PreviewCommentsDocument> => {
  const candidatePaths = [
    getCommentsFilePath(filePath),
    getSadokuSidecarCommentsFilePath(filePath),
    getLegacyDirectoryCommentsFilePath(filePath),
    getLegacyCommentsFilePath(filePath),
  ];
  let text: string | undefined;
  for (const candidatePath of candidatePaths) {
    text = await Deno.readTextFile(candidatePath).catch((error) => {
      if (error instanceof Deno.errors.NotFound) return undefined;
      throw error;
    });
    if (text !== undefined) break;
  }
  if (text === undefined) return createEmptyCommentsDocument(filePath);

  const parsed = JSON.parse(text) as Partial<PreviewCommentsDocument>;
  if (!Array.isArray(parsed.comments)) {
    return createEmptyCommentsDocument(filePath);
  }

  return {
    comments: parsed.comments.filter(isPreviewComment).map(
      normalizePreviewComment,
    ),
    filePath,
    ...(typeof parsed.previousSourceSnapshot === "string"
      ? { previousSourceSnapshot: parsed.previousSourceSnapshot }
      : {}),
    ...(typeof parsed.sourceSnapshot === "string"
      ? { sourceSnapshot: parsed.sourceSnapshot }
      : {}),
  };
};

export const writeCommentsDocument = async (
  filePath: string,
  document: PreviewCommentsDocument,
): Promise<void> => {
  const commentsDirectory = getCommentsDirectoryPath();
  await Deno.mkdir(commentsDirectory, { recursive: true });
  const temporaryPath = await Deno.makeTempFile({
    dir: commentsDirectory,
    prefix: ".comments-",
    suffix: ".tmp",
  });
  try {
    await Deno.writeTextFile(
      temporaryPath,
      `${JSON.stringify(document, null, 2)}\n`,
    );
    await Deno.rename(temporaryPath, getCommentsFilePath(filePath));
  } catch (error) {
    await Deno.remove(temporaryPath).catch(() => {});
    throw error;
  }
};

export const listCommentsFiles = async (): Promise<CommentsStoreFileList> => {
  const commentsDirectoryPath = getCommentsDirectoryPath();
  const directoryEntries = await Array.fromAsync(
    Deno.readDir(commentsDirectoryPath),
  ).catch((error) => {
    if (error instanceof Deno.errors.NotFound) return [];
    throw error;
  });
  const entries: CommentsStoreFile[] = [];
  const warnings: string[] = [];

  for (const entry of directoryEntries) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue;

    const filePath = join(commentsDirectoryPath, entry.name);
    try {
      const document = parseStoredCommentsDocument(
        await Deno.readTextFile(filePath),
      );
      entries.push({
        commentCount: document.comments.length,
        fileName: basename(filePath),
        markdownPath: document.filePath,
        openCount: document.comments.filter((comment) =>
          comment.resolved !== true
        ).length,
        updatedAt: latestUpdatedAt(document.comments),
      });
    } catch (error) {
      warnings.push(
        `Skipping ${entry.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return {
    entries: entries.sort((left, right) =>
      left.fileName.localeCompare(right.fileName)
    ),
    warnings,
  };
};

export const deleteCommentsDocument = async (
  filePath: string,
): Promise<void> => {
  await Deno.remove(getCommentsFilePath(filePath));
};

export const fileCommentsStore: CommentsStore = {
  delete: deleteCommentsDocument,
  list: listCommentsFiles,
  read: readCommentsDocument,
  write: writeCommentsDocument,
};
