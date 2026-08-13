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
