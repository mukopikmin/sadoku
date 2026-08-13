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

export const updateReply = async (
  deps: CommentsDependencies,
  source: CommentSource,
  input: { commentId: number; replyId: number; body: string },
) => {
  const document = await deps.commentsStore.read(source.commentSource);
  const index = findComment(document, input.commentId);
  const replies = [...(document.comments[index].replies ?? [])];
  const replyIndex = replies.findIndex((reply) => reply.id === input.replyId);
  if (replyIndex < 0) {
    throwCommentsError({
      type: "reply_not_found",
      commentId: input.commentId,
      replyId: input.replyId,
    });
  }
  const now = deps.now();
  replies[replyIndex] = {
    ...replies[replyIndex],
    body: body(input.body, "reply"),
    updatedAt: now,
  };
  return await saveComment(deps, source, document, index, {
    ...document.comments[index],
    replies,
    updatedAt: now,
  });
};
