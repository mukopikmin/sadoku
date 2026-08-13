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
