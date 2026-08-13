import type {
  CommentAuthor,
  PreviewComment,
  PreviewCommentReply,
  PreviewCommentsDocument,
} from "./types.ts";
import type { CommentsDependencies } from "./ports.ts";
import { throwCommentsError } from "./errors.ts";
import {
  body,
  type CommentSource,
  findComment,
  hash,
  nextId,
  rangeText,
  saveComment,
} from "./helpers.ts";

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
