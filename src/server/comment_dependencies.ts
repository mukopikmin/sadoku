import type { PreviewSource } from "./source.ts";
import { readMarkdownSource } from "./source.ts";
import type {
  CommentsDependencies,
  CommentsStore,
} from "./usecase/comment/ports.ts";
export const createCommentsDependencies = (
  commentsStore: CommentsStore,
  source: PreviewSource,
  readMarkdown = readMarkdownSource,
): CommentsDependencies => ({
  commentsStore,
  readMarkdown: async (markdownSource) => {
    try {
      return await readMarkdown(markdownSource);
    } catch (error) {
      if (markdownSource !== source.documentSource) throw error;
      const snapshot = (await commentsStore.read(source.commentSource))
        .sourceSnapshot;
      if (snapshot === undefined) throw error;
      return snapshot;
    }
  },
  now: () => new Date().toISOString(),
});
