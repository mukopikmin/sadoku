import type { CommentsDependencies } from "./ports.ts";
import { type CommentSource, withCurrentSource } from "./helpers.ts";
import { readResolvedCommentsDocument } from "./position.ts";

export const readPreviewComments = async (
  deps: Pick<CommentsDependencies, "commentsStore" | "readMarkdown">,
  source: CommentSource,
  githubHeadSha?: string,
) => {
  const { previousSourceSnapshot: _, sourceSnapshot, ...document } =
    await readResolvedCommentsDocument(
      source.commentSource,
      source.documentSource,
      deps.commentsStore,
      deps.readMarkdown,
    );
  return {
    ...document,
    comments: document.comments.map((comment) =>
      withCurrentSource(comment, sourceSnapshot)
    ),
    ...(githubHeadSha ? { githubHeadSha } : {}),
  };
};
