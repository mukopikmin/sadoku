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

export const getComments = async (
  deps: CommentsDependencies,
  source: CommentSource,
): Promise<PreviewCommentsDocument> =>
  await deps.commentsStore.read(source.commentSource);
