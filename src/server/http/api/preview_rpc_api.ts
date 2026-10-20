import { updateDocumentTitle } from "../../usecase/document/update_document_title.ts";
import { isSettingsError } from "../../usecase/settings/types.ts";
import type { MessageInitShape, MessageShape } from "@bufbuild/protobuf";
import { PreviewService } from "../../../../gen/ts/sadoku/preview/v1/preview_pb.ts";
import { createCommentsDependencies } from "../../session/comment_dependencies.ts";
import { connectFailure } from "../connect/unary.ts";
import type { DirectorySessionState } from "../../session/directory_session.ts";
import type { RunGitHubCommand } from "../../github/pull.ts";
import { createPreviewSource } from "../../session/source.ts";
import type { CommentsStore } from "../../usecase/comment/ports.ts";
import {
  commentsErrorMessage,
  isCommentsUseCaseError,
} from "../../usecase/comment/errors.ts";
import {
  addComment,
  addReply,
  deleteComment,
  deleteReply,
  setCommentResolution,
  updateComment,
  updateReply,
} from "../../usecase/comment/mod.ts";
import type {
  DirectorySession,
  DocumentStore,
} from "../../usecase/document/mod.ts";
import {
  getDirectoryDocument,
  isDocumentUseCaseError,
  listDirectoryDocuments,
} from "../../usecase/document/mod.ts";
import { getGitHubAccount } from "../../usecase/account/get_github_account.ts";
import type { InstructionStore } from "../../usecase/instruction/ports.ts";
import { isInstructionError } from "../../usecase/instruction/errors.ts";
import {
  addInstruction,
  deleteInstruction,
  listInstructions,
  updateInstruction,
} from "../../usecase/instruction/mod.ts";
import type { MemoryStore } from "../../usecase/memory/ports.ts";
import { isMemoryError } from "../../usecase/memory/errors.ts";
import { deleteMemory, listMemories } from "../../usecase/memory/mod.ts";
import type { StatisticsReader } from "../../usecase/statistics/get_statistics.ts";
import { getSettings } from "../../usecase/settings/get_settings.ts";
import { updateSettings } from "../../usecase/settings/update_settings.ts";
import type { TagStore } from "../../usecase/tag/ports.ts";
import type { TagError } from "../../usecase/tag/types.ts";
import { deleteTag } from "../../usecase/tag/delete_tag.ts";
import { updateTag } from "../../usecase/tag/update_tag.ts";
import { replaceDocumentTags } from "../../usecase/tag/replace_document_tags.ts";
import { githubExportErrors } from "./comment_api.ts";
import { exportPreviewComment } from "../../session/export_comment.ts";
import { readPreviewComments } from "../../usecase/comment/read_preview_comments.ts";
import { readDirectoryDocument } from "../../session/load_document.ts";
import { previewSettingsStore, settingsErrorMessage } from "./settings_api.ts";
import { getSessionResponse, getStatisticsResponse } from "./preview_api.ts";
import { createDocumentResponse } from "./create_document_api.ts";
import { readConfig } from "../../config/config.ts";
import {
  commentMessage,
  directoryStatusMessage,
  documentMessage,
  documentSummaryMessage,
  githubAccountMessage,
  instructionMessage,
  memoryMessage,
  settingsMessage,
  tagMessage,
  tagSummaryMessage,
} from "./preview_messages.ts";

type PreviewHandlers = {
  [K in keyof typeof PreviewService.method]: (
    input: MessageShape<typeof PreviewService.method[K]["input"]>,
  ) =>
    | MessageInitShape<typeof PreviewService.method[K]["output"]>
    | Promise<MessageInitShape<typeof PreviewService.method[K]["output"]>>;
};
export type PreviewRpcDependencies = {
  session: DirectorySession;
  commentsStore: CommentsStore;
  documentStore?: DocumentStore;
  instructionStore?: InstructionStore;
  tagStore?: TagStore;
  memoryStore?: MemoryStore;
  directoryState?: DirectorySessionState;
  statistics?: StatisticsReader;
  runGitHubCommand?: RunGitHubCommand;
  isExporting: () => boolean;
  setExporting: (value: boolean) => void;
};

const tagResult = <T>(result: T | TagError): T => {
  if (typeof result === "object" && result !== null && "type" in result) {
    throw connectFailure(
      result.type === "invalid"
        ? "invalid_argument"
        : result.type === "not_found"
        ? "not_found"
        : "already_exists",
      result.message,
      result.type === "invalid" ? 400 : result.type === "not_found" ? 404 : 409,
    );
  }
  return result;
};

// Map application failures at the RPC boundary without serializing an HTTP response.
export const previewRpcOperation = async <T>(
  operation: () => T | Promise<T>,
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (isInstructionError(error)) {
      throw error.type === "instruction_not_found"
        ? connectFailure("not_found", "Instruction not found.", 404)
        : connectFailure(
          "invalid_argument",
          "Instruction content must not be empty.",
          400,
        );
    }
    if (isMemoryError(error)) {
      throw connectFailure("not_found", "Memory not found.", 404);
    }
    if (isDocumentUseCaseError(error)) {
      throw connectFailure(
        "not_found",
        error.type === "document_not_found"
          ? "Document not found."
          : "Saved Markdown snapshot not found.",
        404,
      );
    }
    if (isCommentsUseCaseError(error)) {
      const missing = error.type === "comment_not_found" ||
        error.type === "reply_not_found";
      throw connectFailure(
        missing ? "not_found" : "invalid_argument",
        error.type === "comment_not_found"
          ? "Comment not found."
          : error.type === "reply_not_found"
          ? "Reply not found."
          : commentsErrorMessage(error),
        missing ? 404 : 400,
      );
    }
    if (isSettingsError(error)) {
      throw connectFailure(
        "invalid_argument",
        settingsErrorMessage(error),
        400,
      );
    }
    throw error;
  }
};

const exportFailure = (
  code: keyof typeof githubExportErrors,
  status = githubExportErrors[code],
): never => {
  throw connectFailure(
    status === 400
      ? "invalid_argument"
      : status === 404
      ? "not_found"
      : status === 409
      ? "already_exists"
      : "internal",
    JSON.stringify({ error: { code } }),
    status,
  );
};
const unavailable = (feature: string): never => {
  throw connectFailure("unimplemented", `${feature} are unavailable.`, 501);
};
const commentBody = (value: string): string => {
  if (!value.trim()) {
    throw connectFailure("invalid_argument", "Comment body is required.", 400);
  }
  return value.trim();
};
const validateRange = (startLine: number, endLine: number) => {
  if (startLine < 1) {
    throw connectFailure(
      "invalid_argument",
      "Comment startLine must be a positive integer.",
      400,
    );
  }
  if (endLine < 1) {
    throw connectFailure(
      "invalid_argument",
      "Comment endLine must be a positive integer.",
      400,
    );
  }
  if (endLine < startLine) {
    throw connectFailure(
      "invalid_argument",
      "Comment endLine must be greater than or equal to startLine.",
      400,
    );
  }
};

export const createPreviewRpcHandlers = (deps: PreviewRpcDependencies) => {
  const {
    session,
    commentsStore,
    documentStore,
    instructionStore,
    tagStore,
    memoryStore,
  } = deps;
  const resolveDocument = (id: bigint) => {
    // Proto uint64 may exceed the safe integer range used by storage.
    if (id < 1n || id > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw connectFailure("not_found", "Document not found.", 404);
    }
    const document = getDirectoryDocument(session, Number(id));
    return { document, source: createPreviewSource(document.filePath) };
  };
  const commentDependencies = (
    source: ReturnType<typeof createPreviewSource>,
  ) => createCommentsDependencies(commentsStore, source, session.readMarkdown);
  const instructions = () => instructionStore ?? unavailable("Instructions");
  const tags = () => tagStore ?? unavailable("Tags");
  const memories = () => memoryStore ?? unavailable("Memories");
  return {
    getSession: () =>
      getSessionResponse({
        ...session,
        canCreateDocuments: Boolean(
          documentStore && session.canCreateDocuments,
        ),
      }),
    getStatistics: () => getStatisticsResponse(deps.statistics),
    listDocuments: async () => ({
      documents: (await listDirectoryDocuments(session.documents, tagStore))
        .map(documentSummaryMessage),
    } satisfies MessageInitShape<
      typeof PreviewService.method.listDocuments.output
    >),
    createDocument: (input) =>
      createDocumentResponse(
        input,
        session,
        documentStore,
        !deps.directoryState || deps.directoryState.status.state === "ready",
        readConfig()?.markdownExtensions,
      ),
    updateDocumentTitle: async ({ documentId, title }) => {
      const { document } = resolveDocument(documentId);
      if (!documentStore) return unavailable("Document titles");
      try {
        return documentSummaryMessage(
          await updateDocumentTitle(document, title, documentStore),
        );
      } catch (error) {
        if (typeof error === "object" && error !== null && "type" in error) {
          if (error.type === "invalid_document_title") {
            throw connectFailure(
              "invalid_argument",
              "Enter a single-line title.",
              400,
            );
          }
          if (error.type === "title_storage_unavailable") {
            return unavailable("Document titles");
          }
        }
        throw error;
      }
    },
    getDocument: async ({ documentId }) => {
      const { document } = resolveDocument(documentId);
      return documentMessage(
        await readDirectoryDocument(
          document,
          documentStore,
          tagStore,
          session.readMarkdown,
        ),
        session.githubPull
          ? new URL(document.filePath).searchParams.get("ref") ?? undefined
          : undefined,
      );
    },
    getDirectoryStatus: () => {
      if (!deps.directoryState) {
        throw connectFailure(
          "unimplemented",
          "Directory status is unavailable.",
          501,
        );
      }
      return directoryStatusMessage(deps.directoryState.status);
    },
    getSettings: () => settingsMessage(getSettings(previewSettingsStore)),
    updateSettings: async (input) =>
      settingsMessage(
        await updateSettings(previewSettingsStore, {
          theme: input.theme,
          codeWrap: input.codeWrap,
          fontScale: input.fontScale,
          excludedDirectories: input.excludedDirectories,
          maxDepth: input.maxDepth,
          maxFiles: input.maxFiles,
          markdownExtensions: input.markdownExtensions,
        }),
      ),
    getGitHubAccount: async () => {
      if (!deps.runGitHubCommand) {
        throw connectFailure(
          "unimplemented",
          "GitHub account is unavailable.",
          501,
        );
      }
      return githubAccountMessage(
        await getGitHubAccount(deps.runGitHubCommand),
      );
    },
    listTags: async () => ({
      tags: (await tags().list()).map(tagSummaryMessage),
    } satisfies MessageInitShape<typeof PreviewService.method.listTags.output>),
    deleteTag: async ({ id }) => {
      const result = await deleteTag(tags(), Number(id));
      if (result) tagResult(result);
      return {};
    },
    updateTag: async ({ id, name, backgroundColor }) =>
      tagMessage(
        tagResult(await updateTag(tags(), Number(id), name, backgroundColor)),
      ),
    replaceDocumentTags: async ({ documentId, tags: references }) => {
      const store = tags();
      const { document } = resolveDocument(documentId);
      const result = await replaceDocumentTags(
        store,
        document.id,
        references.map(({ reference }) =>
          reference.case === "id"
            ? { id: Number(reference.value) }
            : { name: reference.value }
        ),
      );
      return {
        tags: tagResult(result).map(tagMessage),
      } satisfies MessageInitShape<
        typeof PreviewService.method.replaceDocumentTags.output
      >;
    },
    listInstructions: async ({ documentId }) => {
      const store = instructions();
      const { document } = resolveDocument(documentId);
      return {
        instructions: (await listInstructions(store, document.id)).map(
          instructionMessage,
        ),
      } satisfies MessageInitShape<
        typeof PreviewService.method.listInstructions.output
      >;
    },
    createInstruction: async ({ documentId, content }) => {
      const store = instructions();
      const { document } = resolveDocument(documentId);
      return instructionMessage(
        await addInstruction(
          {
            instructionStore: store,
            now: () => new Date().toISOString(),
          },
          document.id,
          content,
        ),
      );
    },
    updateInstruction: async ({ documentId, instructionId, content }) => {
      const store = instructions();
      const { document } = resolveDocument(documentId);
      return instructionMessage(
        await updateInstruction(
          {
            instructionStore: store,
            now: () => new Date().toISOString(),
          },
          document.id,
          Number(instructionId),
          content,
        ),
      );
    },
    deleteInstruction: async ({ documentId, instructionId }) => {
      const store = instructions();
      const { document } = resolveDocument(documentId);
      await deleteInstruction(store, document.id, Number(instructionId));
      return {};
    },
    listMemories: async ({ documentId }) => {
      const store = memories();
      const { document } = resolveDocument(documentId);
      return {
        memories: (await listMemories(store, document.id)).map(memoryMessage),
      } satisfies MessageInitShape<
        typeof PreviewService.method.listMemories.output
      >;
    },
    deleteMemory: async ({ documentId, memoryId }) => {
      const store = memories();
      const { document } = resolveDocument(documentId);
      await deleteMemory(store, document.id, Number(memoryId));
      return {};
    },
    listComments: async ({ documentId }) => {
      const { source } = resolveDocument(documentId);
      const result = await readPreviewComments(
        commentDependencies(source),
        source,
        session.githubPull
          ? new URL(source.documentSource).searchParams.get("ref") ?? undefined
          : undefined,
      );
      return {
        filePath: result.filePath,
        comments: result.comments.map(commentMessage),
        githubHeadSha: result.githubHeadSha,
      } satisfies MessageInitShape<
        typeof PreviewService.method.listComments.output
      >;
    },
    createComment: async ({ documentId, startLine, endLine, body }) => {
      const { source } = resolveDocument(documentId);
      validateRange(startLine, endLine);
      return commentMessage(
        await addComment(commentDependencies(source), source, {
          startLine,
          endLine,
          body: commentBody(body),
        }),
      );
    },
    updateComment: async ({ documentId, commentId, body }) => {
      const { source } = resolveDocument(documentId);
      return commentMessage(
        await updateComment(
          commentDependencies(source),
          source,
          Number(commentId),
          commentBody(body),
        ),
      );
    },
    deleteComment: async ({ documentId, commentId }) => {
      const { source } = resolveDocument(documentId);
      await deleteComment(
        commentDependencies(source),
        source,
        Number(commentId),
      );
      return {};
    },
    setCommentResolution: async ({ documentId, commentId, resolved }) => {
      const { source } = resolveDocument(documentId);
      return commentMessage(
        await setCommentResolution(
          commentDependencies(source),
          source,
          Number(commentId),
          resolved,
        ),
      );
    },
    createReply: async ({ documentId, commentId, body }) => {
      const { source } = resolveDocument(documentId);
      return commentMessage(
        await addReply(commentDependencies(source), source, {
          commentId: Number(commentId),
          body: commentBody(body),
        }),
      );
    },
    updateReply: async ({ documentId, commentId, replyId, body }) => {
      const { source } = resolveDocument(documentId);
      return commentMessage(
        await updateReply(commentDependencies(source), source, {
          commentId: Number(commentId),
          replyId: Number(replyId),
          body: commentBody(body),
        }),
      );
    },
    deleteReply: async ({ documentId, commentId, replyId }) => {
      const { source } = resolveDocument(documentId);
      await deleteReply(
        commentDependencies(source),
        source,
        Number(commentId),
        Number(replyId),
      );
      return {};
    },
    exportCommentToGitHub: async (input) => {
      let resolved;
      try {
        resolved = resolveDocument(input.documentId);
      } catch {
        return exportFailure("export_document_not_found");
      }
      if (!session.githubPull || !deps.runGitHubCommand) {
        return exportFailure("export_unavailable", 404);
      }
      if (deps.isExporting()) return exportFailure("export_busy");
      // Proto3 scalars default to zero/empty: generated types alone do not
      // enforce the positive range, nonblank body, or revision requirements.
      if (
        !input.body.trim() || input.startLine < 1 ||
        input.endLine < input.startLine || !input.createdAt ||
        !/^[a-f0-9]{40,64}$/.test(input.headSha)
      ) return exportFailure("export_invalid_request");
      deps.setExporting(true);
      try {
        const result = await exportPreviewComment(
          {
            startLine: input.startLine,
            endLine: input.endLine,
            body: input.body.trim(),
            createdAt: input.createdAt,
            headSha: input.headSha,
            displayedMarkdown: input.displayedMarkdown,
          },
          session,
          resolved.document.id,
          Number(input.commentId),
          resolved.source,
          commentsStore,
          deps.runGitHubCommand,
        );
        return {
          url: result.url,
          state: result.state,
        } satisfies MessageInitShape<
          typeof PreviewService.method.exportCommentToGitHub.output
        >;
      } catch (error) {
        if (typeof error === "object" && error !== null && "type" in error) {
          // Explicit narrowing keeps transport codes independent of exceptions.
          switch (error.type) {
            case "export_unavailable":
            case "export_out_of_sync":
            case "export_markdown_changed":
            case "export_comment_not_found":
            case "export_comment_ineligible":
            case "export_review_out_of_sync":
            case "export_outside_diff":
            case "export_document_not_found":
              return exportFailure(error.type);
          }
        }
        return exportFailure("export_failed");
      } finally {
        deps.setExporting(false);
      }
    },
  } satisfies PreviewHandlers;
};
