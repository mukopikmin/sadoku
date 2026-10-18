import type { CommentsDependencies } from "./ports.ts";
import type { CommentSource } from "./helpers.ts";
import { readResolvedCommentsDocument } from "./position.ts";

export const readPreviewComments = async (
  deps: Pick<CommentsDependencies, "commentsStore" | "readMarkdown">,
  source: CommentSource,
  githubHeadSha?: string,
) => {
  const { previousSourceSnapshot: _, sourceSnapshot: __, ...document } =
    await readResolvedCommentsDocument(
      source.commentSource,
      source.documentSource,
      deps.commentsStore,
      deps.readMarkdown,
    );
  return {
    ...document,
    ...(githubHeadSha ? { githubHeadSha } : {}),
  };
};
