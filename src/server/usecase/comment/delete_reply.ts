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

export const deleteReply = async (
  deps: CommentsDependencies,
  source: CommentSource,
  commentId: number,
  replyId: number,
) => {
  const document = await deps.commentsStore.read(source.commentSource);
  const index = findComment(document, commentId);
  const replies = document.comments[index].replies ?? [];
  if (!replies.some((reply) => reply.id === replyId)) {
    throwCommentsError({ type: "reply_not_found", commentId, replyId });
  }
  await saveComment(deps, source, document, index, {
    ...document.comments[index],
    replies: replies.filter((reply) => reply.id !== replyId),
    updatedAt: deps.now(),
  });
};
