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

export const updateComment = async (
  deps: CommentsDependencies,
  source: CommentSource,
  commentId: number,
  value: string,
) => {
  const document = await deps.commentsStore.read(source.commentSource);
  const index = findComment(document, commentId);
  return await saveComment(deps, source, document, index, {
    ...document.comments[index],
    body: body(value, "comment"),
    updatedAt: deps.now(),
  });
};
