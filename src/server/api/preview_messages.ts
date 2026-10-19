import type { MessageInitShape } from "@bufbuild/protobuf";
import type {
  CommentReplySchema,
  CommentSchema,
  DocumentSummarySchema,
  GetDirectoryStatusResponseSchema,
  GetDocumentResponseSchema,
  GetGitHubAccountResponseSchema,
  InstructionSchema,
  MemorySchema,
  SettingsSchema,
  TagSchema,
  TagSummarySchema,
} from "../../../gen/ts/sadoku/preview/v1/preview_pb.ts";
import { connectFailure } from "../connect/unary.ts";
import type { DirectorySessionStatus } from "../directory_session.ts";
import type { GetGitHubAccountResult } from "../usecase/account/get_github_account.ts";
import type {
  PreviewComment,
  PreviewCommentReply,
} from "../usecase/comment/types.ts";
import type {
  DirectoryDocumentContent,
  DirectoryDocumentSummary,
  PublicDocumentTag,
} from "../usecase/document/types.ts";
import type { DocumentInstruction as Instruction } from "../usecase/instruction/types.ts";
import type { DocumentMemory as Memory } from "../usecase/memory/types.ts";
import type { TagSummary } from "../usecase/tag/types.ts";
import type { PreviewSettings } from "../usecase/settings/types.ts";

// Protobuf init types allow omitted scalars (which become Proto3 defaults).
// Select every public field explicitly; never spread domain/storage objects here.
// Optional values use undefined, preserving absence as well as false/0/"".
export const toUint64 = (value: number): bigint => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw connectFailure("internal", "Invalid response integer.", 500);
  }
  return BigInt(value);
};

// Protobuf init types use number for uint32 but do not enforce its range.
export const toUint32 = (value: number): number => {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw connectFailure("internal", "Invalid response integer.", 500);
  }
  return value;
};

export const tagMessage = (
  tag: PublicDocumentTag,
): MessageInitShape<typeof TagSchema> => ({
  id: toUint64(tag.id),
  name: tag.name,
  backgroundColor: tag.backgroundColor,
});
export const tagSummaryMessage = (
  tag: TagSummary,
): MessageInitShape<typeof TagSummarySchema> => ({
  id: toUint64(tag.id),
  name: tag.name,
  backgroundColor: tag.backgroundColor,
  documentCount: toUint64(tag.documentCount),
  createdAt: tag.createdAt,
  updatedAt: tag.updatedAt,
});
export const instructionMessage = (
  instruction: Instruction,
): MessageInitShape<typeof InstructionSchema> => ({
  id: toUint64(instruction.id),
  content: instruction.content,
  createdAt: instruction.createdAt,
  updatedAt: instruction.updatedAt,
});
export const memoryMessage = (
  memory: Memory,
): MessageInitShape<typeof MemorySchema> => ({
  id: toUint64(memory.id),
  documentId: toUint64(memory.documentId),
  content: memory.content,
  createdAt: memory.createdAt,
  updatedAt: memory.updatedAt,
});
export const documentSummaryMessage = (
  document: DirectoryDocumentSummary,
): MessageInitShape<typeof DocumentSummarySchema> => ({
  id: toUint64(document.id),
  relativePath: document.relativePath,
  title: document.title,
  displayTitle: document.displayTitle,
  deleted: document.deleted,
  tags: document.tags?.map(tagMessage) ?? [],
});
export const documentMessage = (
  document: DirectoryDocumentContent,
  githubHeadSha?: string,
): MessageInitShape<typeof GetDocumentResponseSchema> => ({
  fileUrl: document.fileUrl ?? "",
  markdown: document.markdown,
  title: document.title,
  displayTitle: document.displayTitle,
  deleted: document.deleted,
  tags: document.tags?.map(tagMessage) ?? [],
  githubHeadSha,
});
export const directoryStatusMessage = (
  status: DirectorySessionStatus,
): MessageInitShape<typeof GetDirectoryStatusResponseSchema> => ({
  state: status.state,
  detected: toUint64(status.detected),
  registered: toUint64(status.registered),
  error: status.state === "error"
    ? { name: status.error.name, message: status.error.message }
    : undefined,
});
export const settingsMessage = (
  settings: PreviewSettings,
): MessageInitShape<typeof SettingsSchema> => ({
  theme: settings.theme,
  codeWrap: settings.codeWrap,
  fontScale: settings.fontScale,
  excludedDirectories: settings.excludedDirectories,
  maxDepth: toUint32(settings.maxDepth),
  maxFiles: toUint32(settings.maxFiles),
  markdownExtensions: settings.markdownExtensions,
});
export const githubAccountMessage = (
  result: GetGitHubAccountResult,
): MessageInitShape<typeof GetGitHubAccountResponseSchema> =>
  result.ok
    ? ({
      ok: true,
      account: {
        login: result.account.login,
        name: result.account.name,
        avatarUrl: result.account.avatarUrl,
      },
    })
    : ({ ok: false, message: result.message });

const replyMessage = (
  reply: PreviewCommentReply,
): MessageInitShape<typeof CommentReplySchema> => ({
  id: toUint64(reply.id),
  author: { type: reply.author.type },
  body: reply.body,
  createdAt: reply.createdAt,
  updatedAt: reply.updatedAt,
  reviewRequested: reply.reviewRequested,
});
export const commentMessage = (
  comment: PreviewComment,
): MessageInitShape<typeof CommentSchema> => ({
  id: toUint64(comment.id),
  author: { type: comment.author.type },
  body: comment.body,
  startLine: toUint32(comment.startLine),
  endLine: toUint32(comment.endLine),
  originalStartLine: toUint32(comment.originalStartLine),
  originalEndLine: toUint32(comment.originalEndLine),
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
  resolved: comment.resolved,
  stale: comment.stale,
  resolvedAt: comment.resolvedAt,
  resolvedBy: comment.resolvedBy
    ? { type: comment.resolvedBy.type }
    : undefined,
  sourceHash: comment.sourceHash,
  sourceText: comment.sourceText,
  replies: comment.replies?.map(replyMessage) ?? [],
  displayLine: comment.displayLine === undefined
    ? undefined
    : toUint32(comment.displayLine),
});
