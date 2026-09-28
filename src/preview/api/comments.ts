import {
  type Comment,
  type CommentReply,
  type CommentsDocument,
  type GitHubCommentExport,
} from "../models/comment";
import { parseGitHubHeadSha } from "./document";
import { ConnectError } from "@connectrpc/connect";
import { previewClient } from "./connect";

export type CommentReplyResponse = {
  author: CommentAuthorResponse;
  body: string;
  createdAt: string;
  id: number;
  reviewRequested?: boolean;
  updatedAt: string;
};

export type CommentResponse = {
  author: CommentAuthorResponse;
  body: string;
  createdAt: string;
  endLine: number;
  id: number;
  originalEndLine: number;
  originalStartLine: number;
  replies?: CommentReplyResponse[];
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: CommentAuthorResponse;
  sourceHash?: string;
  sourceText?: string;
  stale: boolean;
  startLine: number;
  updatedAt: string;
};

type CommentAuthorResponse = {
  type: Comment["author"]["type"];
};

export type CommentsDocumentResponse = {
  githubHeadSha?: string;
  comments: CommentResponse[];
  filePath: string;
};

const toCommentReply = (response: CommentReplyResponse): CommentReply => ({
  author: { type: response.author.type },
  body: response.body,
  createdAt: response.createdAt,
  id: Number(response.id),
  ...(response.reviewRequested === true ? { reviewRequested: true } : {}),
  updatedAt: response.updatedAt,
});

export const toComment = (response: CommentResponse): Comment => {
  const common = {
    author: { type: response.author.type },
    body: response.body,
    createdAt: response.createdAt,
    endLine: response.endLine,
    id: Number(response.id),
    originalEndLine: response.originalEndLine,
    originalStartLine: response.originalStartLine,
    replies: (response.replies ?? []).map(toCommentReply),
    sourceHash: response.sourceHash,
    sourceText: response.sourceText,
    startLine: response.startLine,
    updatedAt: response.updatedAt,
  };

  if (response.resolved) {
    return {
      ...common,
      resolvedAt: response.resolvedAt,
      resolvedBy: response.resolvedBy,
      state: "resolved",
    };
  }
  return { ...common, state: response.stale ? "stale" : "active" };
};

export const toCommentsDocument = (
  response: CommentsDocumentResponse,
): CommentsDocument => ({
  ...(response.githubHeadSha === undefined
    ? {}
    : { githubHeadSha: parseGitHubHeadSha(response.githubHeadSha) }),
  comments: response.comments.map(toComment),
  filePath: response.filePath,
});

const githubExportMessages = {
  export_review_out_of_sync:
    "The GitHub pending review or comment changed, or targets an older revision or different lines. Check the review on GitHub before retrying.",
  export_markdown_changed:
    "The displayed Markdown differs from the remote document. Refresh and review it before saving.",
  export_unavailable: "Only an open GitHub PR can receive comments.",
  export_out_of_sync:
    "The preview or comment is out of sync. Refresh and review it before saving.",
  export_comment_not_found: "Comment not found. Refresh the preview.",
  export_comment_ineligible:
    "Only active human parent comments can be saved to a GitHub review. Replies are excluded.",
  export_outside_diff:
    "The selected lines are outside a single available PR diff hunk.",
  export_busy:
    "A comment is already being saved to the GitHub review. Try again after it finishes.",
  export_json_required:
    "The save request could not be read. Refresh the preview and try again.",
  export_invalid_request:
    "The save request is invalid. Refresh the preview and try again.",
  export_document_not_found: "Document not found. Refresh the preview.",
  export_failed:
    "Could not save to the GitHub review. Check your connection, GitHub authentication and the review on GitHub before retrying.",
};

const githubExportErrorMessage = (value: unknown): string => {
  const code = (value as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof code === "string" && Object.hasOwn(githubExportMessages, code)
    ? githubExportMessages[code as keyof typeof githubExportMessages]
    : githubExportMessages.export_failed;
};

export const exportCommentToGitHub = async (
  documentId: number,
  headSha: string,
  comment: Comment,
  displayedMarkdown: string,
): Promise<GitHubCommentExport> => {
  let value;
  try {
    value = await previewClient.exportCommentToGitHub({
      documentId: BigInt(documentId),
      commentId: BigInt(comment.id),
      headSha,
      displayedMarkdown,
      createdAt: comment.createdAt,
      body: comment.body,
      startLine: comment.startLine,
      endLine: comment.endLine,
    });
  } catch (error) {
    const message = ConnectError.from(error).rawMessage;
    let detail: unknown;
    try {
      detail = JSON.parse(message);
    } catch {
      detail = undefined;
    }
    throw new Error(githubExportErrorMessage(detail));
  }
  if (
    typeof value?.url !== "string" ||
    !/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+(?:\/files|#discussion_r\d+)$/
      .test(
        value.url,
      ) ||
    (value.state !== "pending" && value.state !== "submitted")
  ) {
    throw new Error(
      "Invalid GitHub review response. Check the PR before retrying.",
    );
  }
  return { url: value.url, state: value.state };
};

export const loadComments = async (
  documentId: number,
): Promise<CommentsDocument> => {
  return toCommentsDocument(
    await previewClient.listComments({
      documentId: BigInt(documentId),
    }) as unknown as CommentsDocumentResponse,
  );
};

export const createComment = async (
  startLine: number,
  body: string,
  endLine: number,
  documentId: number,
): Promise<Comment> => {
  return toComment(
    await previewClient.createComment({
      documentId: BigInt(documentId),
      startLine,
      endLine,
      body,
    }) as unknown as CommentResponse,
  );
};

export const createReply = async (
  commentId: number,
  body: string,
  documentId: number,
): Promise<Comment> => {
  return toComment(
    await previewClient.createReply({
      documentId: BigInt(documentId),
      commentId: BigInt(commentId),
      body,
    }) as unknown as CommentResponse,
  );
};

export const updateReply = async (
  commentId: number,
  replyId: number,
  body: string,
  documentId: number,
): Promise<Comment> => {
  return toComment(
    await previewClient.updateReply({
      documentId: BigInt(documentId),
      commentId: BigInt(commentId),
      replyId: BigInt(replyId),
      body,
    }) as unknown as CommentResponse,
  );
};

export const deleteReply = async (
  commentId: number,
  replyId: number,
  documentId: number,
): Promise<void> => {
  await previewClient.deleteReply({
    documentId: BigInt(documentId),
    commentId: BigInt(commentId),
    replyId: BigInt(replyId),
  });
};

export const updateComment = async (
  id: number,
  body: string,
  documentId: number,
): Promise<Comment> => {
  return toComment(
    await previewClient.updateComment({
      documentId: BigInt(documentId),
      commentId: BigInt(id),
      body,
    }) as unknown as CommentResponse,
  );
};

export const resolveComment = async (
  id: number,
  documentId: number,
): Promise<Comment> => {
  return toComment(
    await previewClient.setCommentResolution({
      documentId: BigInt(documentId),
      commentId: BigInt(id),
      resolved: true,
    }) as unknown as CommentResponse,
  );
};

export const reopenComment = async (
  id: number,
  documentId: number,
): Promise<Comment> => {
  return toComment(
    await previewClient.setCommentResolution({
      documentId: BigInt(documentId),
      commentId: BigInt(id),
      resolved: false,
    }) as unknown as CommentResponse,
  );
};

export const deleteComment = async (
  id: number,
  documentId: number,
): Promise<void> => {
  await previewClient.deleteComment({
    documentId: BigInt(documentId),
    commentId: BigInt(id),
  });
};
