import type { PreviewComment } from "./types.ts";

export type CommentExportTarget = {
  headSha: string;
  path: string;
};

export type CommentExportInput = CommentExportTarget & {
  commentId: number;
  createdAt: string;
  body: string;
  displayedMarkdown: string;
  startLine: number;
  endLine: number;
};

export type CommentExportError = {
  type:
    | "export_unavailable"
    | "export_out_of_sync"
    | "export_markdown_changed"
    | "export_comment_not_found"
    | "export_comment_ineligible"
    | "export_review_out_of_sync"
    | "export_outside_diff";
};

export type PendingReview = { id: string; headSha: string };
export type ExportedComment = {
  id: string;
  reviewId: string;
  state: "pending" | "submitted";
  url: string;
  body: string;
  headSha: string;
  path: string;
  startLine: number | null;
  endLine: number | null;
};
export type CommentExportResult = {
  url: string;
  state: "pending" | "submitted";
};
export type ReviewState = {
  pending?: PendingReview;
  comment?: ExportedComment;
};

export type CommentExporter = {
  inspect: (key: string) => Promise<ReviewState>;
  readPull: () => Promise<{ id: string; headSha: string; open: boolean }>;
  supportsRange: (path: string, start: number, end: number) => Promise<boolean>;
  createPending: (
    pullId: string,
    input: CommentExportInput,
    key: string,
  ) => Promise<CommentExportResult>;
  addPending: (
    reviewId: string,
    input: CommentExportInput,
    key: string,
  ) => Promise<CommentExportResult>;
  updatePending: (
    comment: ExportedComment,
    input: CommentExportInput,
    key: string,
  ) => Promise<CommentExportResult>;
};

export type ExportCommentDependencies = {
  readMarkdown: () => Promise<string>;
  readComment: () => Promise<PreviewComment | undefined>;
  readTarget: () => CommentExportTarget | undefined;
  exporter: CommentExporter;
  key: (comment: PreviewComment) => Promise<string>;
};

const fail = (type: CommentExportError["type"]): never => {
  throw { type } satisfies CommentExportError;
};

export const exportComment = async (
  deps: ExportCommentDependencies,
  input: CommentExportInput,
): Promise<CommentExportResult> => {
  const assertTarget = () => {
    const target = deps.readTarget();
    if (!target) return fail("export_unavailable");
    if (target.headSha !== input.headSha || target.path !== input.path) {
      fail("export_out_of_sync");
    }
  };
  assertTarget();
  if (await deps.readMarkdown() !== input.displayedMarkdown) {
    fail("export_markdown_changed");
  }
  const comment = await deps.readComment();
  if (!comment) return fail("export_comment_not_found");
  if (comment.author.type !== "human" || comment.resolved || comment.stale) {
    fail("export_comment_ineligible");
  }
  if (
    comment.createdAt !== input.createdAt || comment.body !== input.body ||
    comment.startLine !== input.startLine ||
    comment.endLine !== input.endLine
  ) fail("export_out_of_sync");
  const key = await deps.key(comment);
  const { pending, comment: existing } = await deps.exporter.inspect(key);
  if (existing?.state === "submitted") {
    return { url: existing.url, state: "submitted" };
  }
  if (pending && pending.headSha !== input.headSha) {
    fail("export_review_out_of_sync");
  }
  if (
    existing && (
      !pending || existing.reviewId !== pending.id ||
      existing.headSha !== input.headSha ||
      existing.path !== input.path || existing.startLine !== input.startLine ||
      existing.endLine !== input.endLine
    )
  ) fail("export_review_out_of_sync");
  if (
    !await deps.exporter.supportsRange(
      input.path,
      input.startLine,
      input.endLine,
    )
  ) fail("export_outside_diff");
  const latest = await deps.readComment();
  if (
    !latest || latest.createdAt !== comment.createdAt ||
    latest.body !== input.body || latest.startLine !== input.startLine ||
    latest.endLine !== input.endLine || latest.resolved || latest.stale ||
    latest.author.type !== "human"
  ) fail("export_out_of_sync");
  // Check again after all reads, including the potentially paginated GitHub reads.
  const pull = await deps.exporter.readPull();
  if (!pull.open) fail("export_unavailable");
  if (pull.headSha !== input.headSha) fail("export_out_of_sync");
  assertTarget();
  if (existing) {
    if (existing.body === input.body) {
      return { url: existing.url, state: "pending" };
    }
    return await deps.exporter.updatePending(existing, input, key);
  }
  return pending
    ? await deps.exporter.addPending(pending.id, input, key)
    : await deps.exporter.createPending(pull.id, input, key);
};
