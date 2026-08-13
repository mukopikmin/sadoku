import {
  type ConfiguredCommentsStore,
  createConfiguredCommentsStore,
} from "../comments/factory.ts";
import type { CommentsStore, CommentsStoreFile } from "../comments/storage.ts";
import {
  readResolvedCommentsDocument,
  resolveCommentPosition,
} from "../comments/position.ts";
import type {
  PreviewComment,
  PreviewCommentsDocument,
} from "../usecase/comment/types.ts";
import { createPreviewSource, readMarkdownSource } from "../source.ts";
import {
  addComment as addCommentUseCase,
  addReply as addReplyUseCase,
  setCommentsResolution,
} from "../usecase/comment/mod.ts";
import {
  commentsErrorMessage,
  isCommentsUseCaseError,
} from "../usecase/comment/errors.ts";

export type ListCommentFilesResult = {
  entries: ListedCommentFile[];
  warnings: string[];
};

export type ListedCommentFile = CommentsStoreFile;

export type CommentsCliOptions = {
  asBot?: boolean;
  commentsStore?: CommentsStore;
  requestReview?: boolean;
};

const useCaseDependencies = (commentsStore: CommentsStore) => ({
  commentsStore,
  readMarkdown: readMarkdownSource,
  now: () => new Date().toISOString(),
});

const mapUseCaseError = (error: unknown): never => {
  if (isCommentsUseCaseError(error)) {
    throw new Error(commentsErrorMessage(error));
  }
  throw error;
};

const withCommentsStore = async <T>(
  options: CommentsCliOptions,
  operation: (commentsStore: CommentsStore) => Promise<T>,
): Promise<T> => {
  const commentsStore = options.commentsStore ??
    await createConfiguredCommentsStore();
  try {
    return await operation(commentsStore);
  } finally {
    if (options.commentsStore === undefined) {
      (commentsStore as ConfiguredCommentsStore).close();
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
  const source = createPreviewSource(filePath);
  try {
    return await withCommentsStore(
      options,
      (store) =>
        addCommentUseCase(useCaseDependencies(store), source, {
          startLine,
          endLine,
          body,
          author: { type: options.asBot ? "bot" : "human" },
        }),
    );
  } catch (error) {
    return mapUseCaseError(error);
  }
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
  try {
    return await withCommentsStore(
      options,
      (store) =>
        setCommentsResolution(
          useCaseDependencies(store),
          source,
          commentIds,
          true,
          { type: options.asBot ? "bot" : "human" },
        ),
    );
  } catch (error) {
    return mapUseCaseError(error);
  }
};

export const replyToComment = async (
  filePath: string,
  commentId: string,
  body: string,
  options: CommentsCliOptions = {},
): Promise<PreviewComment> => {
  const source = createPreviewSource(filePath);
  const parsedCommentId = Number(commentId);
  if (!Number.isFinite(parsedCommentId)) {
    throw new Error(`Comment not found: ${commentId}`);
  }
  try {
    return await withCommentsStore(options, async (store) => {
      const comment = await addReplyUseCase(
        useCaseDependencies(store),
        source,
        {
          commentId: parsedCommentId,
          body,
          author: { type: options.asBot ? "bot" : "human" },
          requestReview: options.requestReview,
        },
      );
      return resolveCommentPosition(
        comment,
        await readMarkdownSource(source.documentSource),
      );
    });
  } catch (error) {
    return mapUseCaseError(error);
  }
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
