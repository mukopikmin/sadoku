import type { CommentsStore } from "../comment/ports.ts";

/** Read the one retained revision without advancing the stored snapshots. */
export const getPreviousMarkdown = async (
  commentsStore: Pick<CommentsStore, "read">,
  commentSource: string,
  currentMarkdown: string,
): Promise<string | undefined> => {
  const document = await commentsStore.read(commentSource);
  // The comment positions may not have been rebased onto the live file yet.
  const previous = document.sourceSnapshot !== undefined &&
      document.sourceSnapshot !== currentMarkdown
    ? document.sourceSnapshot
    : document.previousSourceSnapshot;
  return previous === currentMarkdown ? undefined : previous;
};
