export type CommentsUseCaseError =
  | { type: "body_required"; subject: "comment" | "reply" }
  | { type: "comment_not_found"; commentId: number | string }
  | { type: "reply_not_found"; commentId: number; replyId: number }
  | { type: "invalid_range"; startLine: number; endLine: number }
  | { type: "review_requires_bot" }
  | { type: "review_on_resolved_comment"; commentId: number };

export const isCommentsUseCaseError = (
  value: unknown,
): value is CommentsUseCaseError =>
  typeof value === "object" && value !== null &&
  typeof (value as { type?: unknown }).type === "string" &&
  [
    "body_required",
    "comment_not_found",
    "reply_not_found",
    "invalid_range",
    "review_requires_bot",
    "review_on_resolved_comment",
  ].includes((value as { type: string }).type);

export const commentsErrorMessage = (error: CommentsUseCaseError): string => {
  switch (error.type) {
    case "body_required":
      return `${
        error.subject === "comment" ? "Comment" : "Reply"
      } body is required.`;
    case "comment_not_found":
      return `Comment not found: ${error.commentId}`;
    case "reply_not_found":
      return `Reply not found: ${error.replyId}`;
    case "invalid_range":
      return "Comment range does not exist.";
    case "review_requires_bot":
      return "Review requests require a bot reply.";
    case "review_on_resolved_comment":
      return "Cannot request review on a resolved comment.";
  }
};

export const throwCommentsError = (error: CommentsUseCaseError): never => {
  throw error;
};
