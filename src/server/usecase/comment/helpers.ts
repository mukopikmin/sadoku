import type {
  CommentAuthor,
  PreviewComment,
  PreviewCommentReply,
  PreviewCommentsDocument,
} from "./types.ts";
import type { CommentsDependencies } from "./ports.ts";
import { throwCommentsError } from "./errors.ts";

export type CommentSource = { commentSource: string; documentSource: string };

export const nextId = (ids: number[]): number => Math.max(0, ...ids) + 1;
export const rangeText = (
  markdown: string,
  startLine: number,
  endLine: number,
) => {
  if (startLine < 1 || endLine < startLine) return undefined;
  const lines = markdown.split("\n");
  return endLine > lines.length
    ? undefined
    : lines.slice(startLine - 1, endLine).join("\n");
};
export const hash = (value: string): string => {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
};
export const body = (value: string, subject: "comment" | "reply") => {
  const trimmed = value.trim();
  return trimmed || throwCommentsError({ type: "body_required", subject });
};
export const findComment = (document: PreviewCommentsDocument, id: number) => {
  const index = document.comments.findIndex((comment) => comment.id === id);
  if (index < 0) {
    throwCommentsError({ type: "comment_not_found", commentId: id });
  }
  return index;
};
export const saveComment = async (
  deps: CommentsDependencies,
  source: CommentSource,
  document: PreviewCommentsDocument,
  index: number,
  comment: PreviewComment,
) => {
  const comments = [...document.comments];
  comments[index] = comment;
  await deps.commentsStore.write(source.commentSource, {
    ...document,
    comments,
    filePath: source.commentSource,
  });
  return comment;
};
