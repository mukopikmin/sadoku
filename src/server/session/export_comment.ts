import type { PreviewSource } from "./source.ts";
import { readMarkdownSource } from "./source.ts";
import type { DirectorySession } from "../usecase/document/types.ts";
import type { RunGitHubCommand } from "../github/pull.ts";
import { createGitHubCommentExporter } from "../github/comment.ts";
import { exportComment } from "../usecase/comment/export_comment.ts";
import { readResolvedCommentsDocument } from "../usecase/comment/position.ts";
import type { CommentsStore } from "../usecase/comment/ports.ts";

export const exportPreviewComment = async (
  input: {
    startLine: number;
    endLine: number;
    body: string;
    displayedMarkdown: string;
    headSha: string;
    createdAt: string;
  },
  session: DirectorySession,
  documentId: number,
  commentId: number,
  source: PreviewSource,
  store: CommentsStore,
  run: RunGitHubCommand,
) => {
  const { startLine, endLine, body, displayedMarkdown, headSha, createdAt } =
    input;
  const pull = session.githubPull;
  if (!pull) throw { type: "export_unavailable" };
  const document = session.documentsById.get(documentId);
  if (!document) throw { type: "export_document_not_found" };
  const pullUrl =
    `https://github.com/${pull.owner}/${pull.repo}/pull/${pull.pullNumber}`;
  // Read the immutable head document remotely once for this operation. Never
  // substitute a saved snapshot when checking what the user is viewing.
  let remoteMarkdown: Promise<string> | undefined;
  const readMarkdown = () =>
    remoteMarkdown ??= (session.readMarkdown ?? readMarkdownSource)(
      source.documentSource,
    );
  return await exportComment({
    readMarkdown,
    readTarget: () => {
      const current = session.documentsById.get(documentId);
      return current && !current.deleted
        ? {
          path: current.relativePath,
          headSha: new URL(current.filePath).searchParams.get("ref") ?? "",
        }
        : undefined;
    },
    readComment: async () => {
      const comments = await readResolvedCommentsDocument(
        source.commentSource,
        source.documentSource,
        store,
        readMarkdown,
      );
      return comments.comments.find((comment) => comment.id === commentId);
    },
    exporter: createGitHubCommentExporter({ ...pull, url: pullUrl }, run),
    key: async (comment) => {
      const bytes = new TextEncoder().encode(JSON.stringify([
        pullUrl,
        document.relativePath,
        comment.id,
        comment.createdAt,
      ]));
      return [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ]
        .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    },
  }, {
    startLine,
    endLine,
    body,
    displayedMarkdown,
    headSha,
    commentId,
    createdAt,
    path: document.relativePath,
  });
};
