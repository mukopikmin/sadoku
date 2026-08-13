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

export const addComment = async (
  deps: CommentsDependencies,
  source: CommentSource,
  input: {
    startLine: number;
    endLine: number;
    body: string;
    author?: CommentAuthor;
  },
): Promise<PreviewComment> => {
  const markdown = await deps.readMarkdown(source.documentSource);
  const sourceText = rangeText(markdown, input.startLine, input.endLine);
  if (sourceText === undefined) {
    return throwCommentsError({
      type: "invalid_range",
      startLine: input.startLine,
      endLine: input.endLine,
    });
  }
  const document = await deps.commentsStore.read(source.commentSource);
  const now = deps.now();
  const comment: PreviewComment = {
    author: input.author ?? { type: "human" },
    body: body(input.body, "comment"),
    createdAt: now,
    updatedAt: now,
    id: nextId(document.comments.map((item) => item.id)),
    startLine: input.startLine,
    endLine: input.endLine,
    originalStartLine: input.startLine,
    originalEndLine: input.endLine,
    replies: [],
    resolved: false,
    stale: false,
    sourceText,
    sourceHash: hash(sourceText),
  };
  await deps.commentsStore.write(source.commentSource, {
    ...document,
    comments: [...document.comments, comment],
    filePath: source.commentSource,
    sourceSnapshot: markdown,
  });
  return comment;
};
