import {
  type Comment,
  type CommentReply,
  type CommentsDocument,
  type GitHubCommentExport,
} from "../models/comment";
import { parseGitHubHeadSha } from "./document";

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
  id: response.id,
  ...(response.reviewRequested === true ? { reviewRequested: true } : {}),
  updatedAt: response.updatedAt,
});

export const toComment = (response: CommentResponse): Comment => {
  const common = {
    author: { type: response.author.type },
    body: response.body,
    createdAt: response.createdAt,
    endLine: response.endLine,
    id: response.id,
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

const commentsPath = (documentId: number): string =>
  `/__sadoku/documents/${documentId}/comments`;

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
  const response = await fetch(
    `${commentsPath(documentId)}/${comment.id}/github`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        headSha,
        displayedMarkdown,
        createdAt: comment.createdAt,
        body: comment.body,
        startLine: comment.startLine,
        endLine: comment.endLine,
      }),
    },
  ).catch(() => {
    throw new Error(githubExportMessages.export_failed);
  });
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => undefined);
    throw new Error(githubExportErrorMessage(error));
  }
  const value = await response.json();
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
  const response = await fetch(commentsPath(documentId));
  if (!response.ok) {
    throw new Error(`Failed to load comments: ${response.status}`);
  }
  return toCommentsDocument(await response.json() as CommentsDocumentResponse);
};

export const createComment = async (
  startLine: number,
  body: string,
  endLine: number,
  documentId: number,
): Promise<Comment> => {
  const response = await fetch(commentsPath(documentId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ startLine, endLine, body }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create comment: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const createReply = async (
  commentId: number,
  body: string,
  documentId: number,
): Promise<Comment> => {
  const response = await fetch(
    `${commentsPath(documentId)}/${encodeURIComponent(commentId)}/replies`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to create reply: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const updateReply = async (
  commentId: number,
  replyId: number,
  body: string,
  documentId: number,
): Promise<Comment> => {
  const response = await fetch(
    `${commentsPath(documentId)}/${encodeURIComponent(commentId)}/replies/${
      encodeURIComponent(replyId)
    }`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to update reply: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const deleteReply = async (
  commentId: number,
  replyId: number,
  documentId: number,
): Promise<void> => {
  const response = await fetch(
    `${commentsPath(documentId)}/${encodeURIComponent(commentId)}/replies/${
      encodeURIComponent(replyId)
    }`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete reply: ${response.status}`);
  }
};

export const updateComment = async (
  id: number,
  body: string,
  documentId: number,
): Promise<Comment> => {
  const response = await fetch(
    `${commentsPath(documentId)}/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to update comment: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const resolveComment = async (
  id: number,
  documentId: number,
): Promise<Comment> => {
  const response = await fetch(
    `${commentsPath(documentId)}/${encodeURIComponent(id)}/resolve`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to resolve comment: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const reopenComment = async (
  id: number,
  documentId: number,
): Promise<Comment> => {
  const response = await fetch(
    `${commentsPath(documentId)}/${encodeURIComponent(id)}/reopen`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to reopen comment: ${response.status}`);
  }
  return toComment(await response.json() as CommentResponse);
};

export const deleteComment = async (
  id: number,
  documentId: number,
): Promise<void> => {
  const response = await fetch(
    `${commentsPath(documentId)}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete comment: ${response.status}`);
  }
};
