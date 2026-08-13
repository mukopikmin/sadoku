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

export const addReply = async (
  deps: CommentsDependencies,
  source: CommentSource,
  input: {
    commentId: number;
    body: string;
    author?: CommentAuthor;
    requestReview?: boolean;
  },
) => {
  const document = await deps.commentsStore.read(source.commentSource);
  const index = findComment(document, input.commentId);
  const author = input.author ?? { type: "human" as const };
  if (input.requestReview && author.type !== "bot") {
    throwCommentsError({ type: "review_requires_bot" });
  }
  if (input.requestReview && document.comments[index].resolved) {
    throwCommentsError({
      type: "review_on_resolved_comment",
      commentId: input.commentId,
    });
  }
  const now = deps.now();
  const replies = document.comments[index].replies ?? [];
  const reply: PreviewCommentReply = {
    author,
    body: body(input.body, "reply"),
    createdAt: now,
    id: nextId(replies.map((item) => item.id)),
    updatedAt: now,
    ...(input.requestReview ? { reviewRequested: true } : {}),
  };
  return await saveComment(deps, source, document, index, {
    ...document.comments[index],
    replies: [...replies, reply],
    updatedAt: now,
  });
};
