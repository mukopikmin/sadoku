import { Hono } from "@hono/hono/quick";
import type { Context, Next } from "@hono/hono";
import {
  createComment,
  createReply,
  deleteComment,
  deleteReply,
  exportCommentToGitHub,
  getComments,
  githubExportErrorResponse,
  setCommentResolution,
  updateComment,
  updateReply,
} from "./api/comment_api.ts";
import {
  getDirectoryDocumentResponse,
  listDirectoryDocumentsResponse,
  resolveDirectoryDocumentParameter,
} from "./api/document_api.ts";
import type { CommentsStore } from "./storage/comment/storage.ts";
import type { DirectorySession } from "./usecase/document/mod.ts";
import type { DocumentStore } from "./usecase/document/mod.ts";
import { handlePreviewAssetRequest } from "./preview/assets.ts";
import { createPreviewEventStream } from "./preview/events.ts";
import { renderSpaShell } from "./preview/shell.ts";
import { getCommentsNotificationFilePath } from "./storage/comment/notifications.ts";
import {
  methodNotAllowedResponse,
  noStoreHtml,
  notFoundResponse,
  textResponse,
} from "./responses.ts";
import { getSettings, updateSettings } from "./api/settings_api.ts";
import type { StatisticsReader } from "./usecase/statistics/get_statistics.ts";
import type { DirectorySessionState } from "./directory_session.ts";
import { getDirectoryStatus } from "./api/directory_status_api.ts";
import { logInfo } from "../log.ts";
import type { InstructionStore } from "./usecase/instruction/ports.ts";
import {
  createInstruction,
  getInstructions,
  removeInstruction,
  replaceInstruction,
} from "./api/instruction_api.ts";
import type { TagStore } from "./usecase/tag/ports.ts";
import { listTags, patchTag, putDocumentTags } from "./api/tag_api.ts";
import type { MemoryStore } from "./usecase/memory/ports.ts";
import { getMemories, removeMemory } from "./api/memory_api.ts";
import type { RunGitHubCommand } from "./github_pull.ts";
import { PreviewService } from "../../gen/ts/sadoku/preview/v1/preview_pb.ts";
import {
  type DescMessage,
  type DescMethodUnary,
  fromJson,
  type JsonValue,
} from "@bufbuild/protobuf";
import {
  connectFailure,
  connectMethodNotAllowedResponse,
  connectMethodPath,
  handleConnectUnary,
} from "./connect/unary.ts";
import {
  getSessionResponse,
  getStatisticsResponse,
} from "./api/preview_api.ts";
import { getGitHubAccountResponse } from "./api/github_account_api.ts";

export type DirectoryPreviewHandlerOptions = {
  runGitHubCommand?: RunGitHubCommand;
  log?: (message: string) => void;
  onEventStreamClose?: () => void;
  onEventStreamOpen?: () => void;
  statistics?: StatisticsReader;
  directoryState?: DirectorySessionState;
  subscribeInvalidation?: (listener: () => void) => () => void;
};

export const createDirectoryPreviewHandler = (
  session: DirectorySession,
  commentsStore: CommentsStore,
  options: DirectoryPreviewHandlerOptions = {},
  documentStore?: DocumentStore,
  instructionStore?: InstructionStore,
  tagStore?: TagStore,
  memoryStore?: MemoryStore,
): Deno.ServeHandler => {
  const app = new Hono();
  let exporting = false;
  const log = options.log ?? logInfo;
  const resolveDocument = (rawId: string) =>
    resolveDirectoryDocumentParameter(rawId, session);

  const responseMessage = async <O extends DescMessage>(
    response: Response,
    schema: O,
    transform: (value: unknown) => unknown = (value) => value,
  ) => {
    if (!response.ok) {
      const message = await response.text();
      throw connectFailure(
        response.status === 400
          ? "invalid_argument"
          : response.status === 404
          ? "not_found"
          : response.status === 409
          ? "already_exists"
          : response.status === 501
          ? "unimplemented"
          : "internal",
        message || response.statusText,
        response.status,
      );
    }
    const value = response.status === 204 ? {} : await response.json();
    return fromJson(schema, transform(value) as JsonValue);
  };
  const jsonRequest = (value: unknown) =>
    new Request("http://127.0.0.1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
  const register = <I extends DescMessage, O extends DescMessage>(
    method: DescMethodUnary<I, O>,
    handler: Parameters<typeof handleConnectUnary<I, O>>[2],
  ) => {
    const path = connectMethodPath(method);
    app.post(
      path,
      (context) => handleConnectUnary(context.req.raw, method, handler),
    );
    app.all(path, connectMethodNotAllowedResponse);
  };

  app.use("*", async (_context, next) => {
    try {
      await next();
    } catch (error) {
      if (error instanceof Response) return error;
      const message = error instanceof Error ? error.message : String(error);
      return textResponse(`Failed to render Markdown: ${message}`, 500);
    }
  });

  const logCommentRequest = async (context: Context, next: Next) => {
    const startedAt = performance.now();
    await next();
    log(
      `Processed comment request: ${context.req.method} ${context.req.path} -> ${context.res.status} (${
        Math.round(performance.now() - startedAt)
      }ms)`,
    );
  };
  app.use("/__sadoku/documents/:documentId/comments/*", logCommentRequest);

  app.get(
    "/__sadoku/documents",
    () => listDirectoryDocumentsResponse(session, tagStore),
  );
  const getSessionPath = connectMethodPath(PreviewService.method.getSession);
  app.post(
    getSessionPath,
    (context) =>
      handleConnectUnary(
        context.req.raw,
        PreviewService.method.getSession,
        () => getSessionResponse(session),
      ),
  );
  app.all(getSessionPath, connectMethodNotAllowedResponse);

  const getStatisticsPath = connectMethodPath(
    PreviewService.method.getStatistics,
  );
  app.post(
    getStatisticsPath,
    (context) =>
      handleConnectUnary(
        context.req.raw,
        PreviewService.method.getStatistics,
        () => getStatisticsResponse(options.statistics),
      ),
  );
  app.all(getStatisticsPath, connectMethodNotAllowedResponse);

  register(PreviewService.method.listDocuments, async () =>
    responseMessage(
      await listDirectoryDocumentsResponse(session, tagStore),
      PreviewService.method.listDocuments.output,
      (documents) => ({ documents }),
    ));
  register(
    PreviewService.method.getDocument,
    async ({ documentId }) =>
      responseMessage(
        await getDirectoryDocumentResponse(
          String(documentId),
          session,
          documentStore,
          tagStore,
          session.readMarkdown,
        ),
        PreviewService.method.getDocument.output,
        (value) => {
          const { id: _, relativePath: __, ...document } = value as Record<
            string,
            unknown
          >;
          return document;
        },
      ),
  );
  register(PreviewService.method.getDirectoryStatus, async () => {
    if (!options.directoryState) {
      throw connectFailure(
        "unimplemented",
        "Directory status is unavailable.",
        501,
      );
    }
    return responseMessage(
      getDirectoryStatus(options.directoryState),
      PreviewService.method.getDirectoryStatus.output,
    );
  });
  register(
    PreviewService.method.getSettings,
    () =>
      responseMessage(getSettings(), PreviewService.method.getSettings.output),
  );
  register(PreviewService.method.updateSettings, async ({
    theme,
    codeWrap,
    fontScale,
    excludedDirectories,
    maxDepth,
    maxFiles,
    markdownExtensions,
  }) =>
    responseMessage(
      await updateSettings(jsonRequest({
        theme,
        codeWrap,
        fontScale,
        excludedDirectories,
        maxDepth,
        maxFiles,
        markdownExtensions,
      })),
      PreviewService.method.updateSettings.output,
    ));
  register(PreviewService.method.getGitHubAccount, async () => {
    if (!options.runGitHubCommand) {
      throw connectFailure(
        "unimplemented",
        "GitHub account is unavailable.",
        501,
      );
    }
    return responseMessage(
      await getGitHubAccountResponse(options.runGitHubCommand),
      PreviewService.method.getGitHubAccount.output,
    );
  });
  register(PreviewService.method.listTags, async () => {
    if (!tagStore) {
      throw connectFailure("unimplemented", "Tags are unavailable.", 501);
    }
    return responseMessage(
      await listTags(tagStore),
      PreviewService.method.listTags.output,
      (tags) => ({ tags }),
    );
  });
  register(
    PreviewService.method.updateTag,
    async ({ id, name, backgroundColor }) => {
      if (!tagStore) {
        throw connectFailure(
          "unimplemented",
          "Tags are unavailable.",
          501,
        );
      }
      return responseMessage(
        await patchTag(
          jsonRequest({ name, backgroundColor }),
          Number(id),
          tagStore,
        ),
        PreviewService.method.updateTag.output,
      );
    },
  );
  register(
    PreviewService.method.replaceDocumentTags,
    async ({ documentId, tags }) => {
      if (!tagStore) {
        throw connectFailure(
          "unimplemented",
          "Tags are unavailable.",
          501,
        );
      }
      const { document } = resolveDocument(String(documentId));
      return responseMessage(
        await putDocumentTags(
          jsonRequest({
            tags: tags.map(({ reference }) =>
              reference.case === "id"
                ? { id: Number(reference.value) }
                : { name: reference.value }
            ),
          }),
          document.id,
          tagStore,
        ),
        PreviewService.method.replaceDocumentTags.output,
        (tags) => ({ tags }),
      );
    },
  );
  register(PreviewService.method.listInstructions, async ({ documentId }) => {
    if (!instructionStore) {
      throw connectFailure(
        "unimplemented",
        "Instructions are unavailable.",
        501,
      );
    }
    const { document } = resolveDocument(String(documentId));
    return responseMessage(
      await getInstructions(document.id, instructionStore),
      PreviewService.method.listInstructions.output,
    );
  });
  register(
    PreviewService.method.createInstruction,
    async ({ documentId, content }) => {
      if (!instructionStore) {
        throw connectFailure(
          "unimplemented",
          "Instructions are unavailable.",
          501,
        );
      }
      const { document } = resolveDocument(String(documentId));
      return responseMessage(
        await createInstruction(
          jsonRequest({ content }),
          document.id,
          instructionStore,
        ),
        PreviewService.method.createInstruction.output,
      );
    },
  );
  register(
    PreviewService.method.updateInstruction,
    async ({ documentId, instructionId, content }) => {
      if (!instructionStore) {
        throw connectFailure(
          "unimplemented",
          "Instructions are unavailable.",
          501,
        );
      }
      const { document } = resolveDocument(String(documentId));
      return responseMessage(
        await replaceInstruction(
          jsonRequest({ content }),
          document.id,
          Number(instructionId),
          instructionStore,
        ),
        PreviewService.method.updateInstruction.output,
      );
    },
  );
  register(
    PreviewService.method.deleteInstruction,
    async ({ documentId, instructionId }) => {
      if (!instructionStore) {
        throw connectFailure(
          "unimplemented",
          "Instructions are unavailable.",
          501,
        );
      }
      const { document } = resolveDocument(String(documentId));
      return responseMessage(
        await removeInstruction(
          document.id,
          Number(instructionId),
          instructionStore,
        ),
        PreviewService.method.deleteInstruction.output,
      );
    },
  );
  register(PreviewService.method.listMemories, async ({ documentId }) => {
    if (!memoryStore) {
      throw connectFailure("unimplemented", "Memories are unavailable.", 501);
    }
    const { document } = resolveDocument(String(documentId));
    return responseMessage(
      await getMemories(document.id, memoryStore),
      PreviewService.method.listMemories.output,
    );
  });
  register(
    PreviewService.method.deleteMemory,
    async ({ documentId, memoryId }) => {
      if (!memoryStore) {
        throw connectFailure(
          "unimplemented",
          "Memories are unavailable.",
          501,
        );
      }
      const { document } = resolveDocument(String(documentId));
      return responseMessage(
        await removeMemory(document.id, Number(memoryId), memoryStore),
        PreviewService.method.deleteMemory.output,
      );
    },
  );
  register(PreviewService.method.listComments, async ({ documentId }) => {
    const { source } = resolveDocument(String(documentId));
    return responseMessage(
      await getComments(
        source,
        commentsStore,
        session.readMarkdown,
        session.githubPull
          ? new URL(source.documentSource).searchParams.get("ref") ?? undefined
          : undefined,
      ),
      PreviewService.method.listComments.output,
    );
  });
  register(
    PreviewService.method.createComment,
    async ({ documentId, startLine, endLine, body }) => {
      const { source } = resolveDocument(String(documentId));
      return responseMessage(
        await createComment(
          jsonRequest({ startLine, endLine, body }),
          source,
          commentsStore,
          session.readMarkdown,
        ),
        PreviewService.method.createComment.output,
      );
    },
  );
  register(
    PreviewService.method.updateComment,
    async ({ documentId, commentId, body }) => {
      const { source } = resolveDocument(String(documentId));
      return responseMessage(
        await updateComment(
          jsonRequest({ body }),
          source,
          commentsStore,
          Number(commentId),
        ),
        PreviewService.method.updateComment.output,
      );
    },
  );
  register(
    PreviewService.method.deleteComment,
    async ({ documentId, commentId }) => {
      const { source } = resolveDocument(String(documentId));
      return responseMessage(
        await deleteComment(source, commentsStore, Number(commentId)),
        PreviewService.method.deleteComment.output,
      );
    },
  );
  register(
    PreviewService.method.setCommentResolution,
    async ({ documentId, commentId, resolved }) => {
      const { source } = resolveDocument(String(documentId));
      return responseMessage(
        await setCommentResolution(
          source,
          commentsStore,
          Number(commentId),
          resolved,
        ),
        PreviewService.method.setCommentResolution.output,
      );
    },
  );
  register(
    PreviewService.method.createReply,
    async ({ documentId, commentId, body }) => {
      const { source } = resolveDocument(String(documentId));
      return responseMessage(
        await createReply(
          jsonRequest({ body }),
          source,
          commentsStore,
          Number(commentId),
        ),
        PreviewService.method.createReply.output,
      );
    },
  );
  register(
    PreviewService.method.updateReply,
    async ({ documentId, commentId, replyId, body }) => {
      const { source } = resolveDocument(String(documentId));
      return responseMessage(
        await updateReply(
          jsonRequest({ body }),
          source,
          commentsStore,
          Number(commentId),
          Number(replyId),
        ),
        PreviewService.method.updateReply.output,
      );
    },
  );
  register(
    PreviewService.method.deleteReply,
    async ({ documentId, commentId, replyId }) => {
      const { source } = resolveDocument(String(documentId));
      return responseMessage(
        await deleteReply(
          source,
          commentsStore,
          Number(commentId),
          Number(replyId),
        ),
        PreviewService.method.deleteReply.output,
      );
    },
  );
  register(
    PreviewService.method.exportCommentToGitHub,
    async ({
      documentId,
      commentId,
      headSha,
      displayedMarkdown,
      createdAt,
      body,
      startLine,
      endLine,
    }) => {
      let resolved;
      try {
        resolved = resolveDocument(String(documentId));
      } catch {
        return responseMessage(
          githubExportErrorResponse("export_document_not_found"),
          PreviewService.method.exportCommentToGitHub.output,
        );
      }
      if (!session.githubPull || !options.runGitHubCommand) {
        return responseMessage(
          githubExportErrorResponse("export_unavailable", 404),
          PreviewService.method.exportCommentToGitHub.output,
        );
      }
      if (exporting) {
        return responseMessage(
          githubExportErrorResponse("export_busy"),
          PreviewService.method.exportCommentToGitHub.output,
        );
      }
      exporting = true;
      try {
        return responseMessage(
          await exportCommentToGitHub(
            jsonRequest({
              headSha,
              displayedMarkdown,
              createdAt,
              body,
              startLine,
              endLine,
            }),
            session,
            resolved.document.id,
            Number(commentId),
            resolved.source,
            commentsStore,
            options.runGitHubCommand,
          ),
          PreviewService.method.exportCommentToGitHub.output,
        );
      } finally {
        exporting = false;
      }
    },
  );
  if (tagStore) {
    app.get("/__sadoku/tags", () => listTags(tagStore));
    app.patch(
      "/__sadoku/tags/:tagId",
      (context) =>
        patchTag(context.req.raw, Number(context.req.param("tagId")), tagStore),
    );
    app.put("/__sadoku/documents/:documentId/tags", (context) => {
      const { document } = resolveDocument(context.req.param("documentId"));
      return putDocumentTags(context.req.raw, document.id, tagStore);
    });
    app.all("/__sadoku/tags", methodNotAllowedResponse);
    app.all("/__sadoku/tags/*", methodNotAllowedResponse);
    app.all("/__sadoku/documents/:documentId/tags", methodNotAllowedResponse);
  }
  if (options.directoryState) {
    app.get(
      "/__sadoku/directory-status",
      () => getDirectoryStatus(options.directoryState!),
    );
    app.all("/__sadoku/directory-status", methodNotAllowedResponse);
  }
  app.get("/__sadoku/settings", getSettings);
  app.put("/__sadoku/settings", (context) => updateSettings(context.req.raw));
  app.all("/__sadoku/settings", methodNotAllowedResponse);
  if (options.runGitHubCommand) {
    app.get(
      "/__sadoku/github-account",
      () => getGitHubAccountResponse(options.runGitHubCommand!),
    );
    app.all("/__sadoku/github-account", methodNotAllowedResponse);
  }
  app.get("/__sadoku/events", (context) =>
    new Response(
      createPreviewEventStream(undefined, context.req.raw.signal, options),
      {
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
          connection: "keep-alive",
        },
      },
    ));
  app.get(
    "/__sadoku/documents/:documentId",
    (context) =>
      getDirectoryDocumentResponse(
        context.req.param("documentId"),
        session,
        documentStore,
        tagStore,
        session.readMarkdown,
      ),
  );

  app.get("/__sadoku/documents/:documentId/events", (context) => {
    const { source } = resolveDocument(context.req.param("documentId"));
    return new Response(
      createPreviewEventStream(
        source.isRemote ? undefined : source.documentSource,
        context.req.raw.signal,
        {
          commentsNotificationPath: getCommentsNotificationFilePath(
            source.commentSource,
          ),
          subscribeInvalidation: options.subscribeInvalidation,
        },
      ),
      {
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
          connection: "keep-alive",
        },
      },
    );
  });

  app.get("/__sadoku/documents/:documentId/comments", (context) => {
    const { source } = resolveDocument(context.req.param("documentId"));
    return getComments(
      source,
      commentsStore,
      session.readMarkdown,
      session.githubPull
        ? new URL(source.documentSource).searchParams.get("ref") ?? undefined
        : undefined,
    );
  });
  app.post(
    "/__sadoku/documents/:documentId/comments/:commentId/github",
    async (context) => {
      let resolved;
      try {
        resolved = resolveDocument(context.req.param("documentId"));
      } catch {
        return githubExportErrorResponse("export_document_not_found");
      }
      const { document, source } = resolved;
      if (
        !session.githubPull || !options.runGitHubCommand
      ) return githubExportErrorResponse("export_unavailable", 404);
      const commentId = Number(context.req.param("commentId"));
      if (
        !Number.isSafeInteger(commentId) || commentId < 1
      ) return githubExportErrorResponse("export_comment_not_found");
      // Serialize all comments in this PR session so two different comments
      // cannot race to create its first pending review.
      if (exporting) {
        return githubExportErrorResponse("export_busy");
      }
      exporting = true;
      try {
        return await exportCommentToGitHub(
          context.req.raw,
          session,
          document.id,
          commentId,
          source,
          commentsStore,
          options.runGitHubCommand,
        );
      } finally {
        exporting = false;
      }
    },
  );
  if (instructionStore) {
    app.get("/__sadoku/documents/:documentId/instructions", (context) => {
      const { document } = resolveDocument(context.req.param("documentId"));
      return getInstructions(document.id, instructionStore);
    });
    app.post("/__sadoku/documents/:documentId/instructions", (context) => {
      const { document } = resolveDocument(context.req.param("documentId"));
      return createInstruction(context.req.raw, document.id, instructionStore);
    });
    app.put(
      "/__sadoku/documents/:documentId/instructions/:instructionId",
      (context) => {
        const { document } = resolveDocument(context.req.param("documentId"));
        return replaceInstruction(
          context.req.raw,
          document.id,
          Number(context.req.param("instructionId")),
          instructionStore,
        );
      },
    );
    app.delete(
      "/__sadoku/documents/:documentId/instructions/:instructionId",
      (context) => {
        const { document } = resolveDocument(context.req.param("documentId"));
        return removeInstruction(
          document.id,
          Number(context.req.param("instructionId")),
          instructionStore,
        );
      },
    );
    app.all(
      "/__sadoku/documents/:documentId/instructions",
      methodNotAllowedResponse,
    );
    app.all(
      "/__sadoku/documents/:documentId/instructions/*",
      methodNotAllowedResponse,
    );
  }
  if (memoryStore) {
    app.get("/__sadoku/documents/:documentId/memories", (context) => {
      const { document } = resolveDocument(context.req.param("documentId"));
      return getMemories(document.id, memoryStore);
    });
    app.delete(
      "/__sadoku/documents/:documentId/memories/:memoryId",
      (context) => {
        const { document } = resolveDocument(context.req.param("documentId"));
        return removeMemory(
          document.id,
          Number(context.req.param("memoryId")),
          memoryStore,
        );
      },
    );
    app.all(
      "/__sadoku/documents/:documentId/memories",
      methodNotAllowedResponse,
    );
    app.all(
      "/__sadoku/documents/:documentId/memories/*",
      methodNotAllowedResponse,
    );
  }
  app.post("/__sadoku/documents/:documentId/comments", (context) => {
    const { source } = resolveDocument(context.req.param("documentId"));
    return createComment(
      context.req.raw,
      source,
      commentsStore,
      session.readMarkdown,
    );
  });
  app.put("/__sadoku/documents/:documentId/comments/:commentId", (context) => {
    const { source } = resolveDocument(context.req.param("documentId"));
    return updateComment(
      context.req.raw,
      source,
      commentsStore,
      Number(context.req.param("commentId")),
    );
  });
  app.delete(
    "/__sadoku/documents/:documentId/comments/:commentId",
    (context) => {
      const { source } = resolveDocument(context.req.param("documentId"));
      return deleteComment(
        source,
        commentsStore,
        Number(context.req.param("commentId")),
      );
    },
  );
  app.post(
    "/__sadoku/documents/:documentId/comments/:commentId/resolve",
    (context) => {
      const { source } = resolveDocument(context.req.param("documentId"));
      return setCommentResolution(
        source,
        commentsStore,
        Number(context.req.param("commentId")),
        true,
      );
    },
  );
  app.post(
    "/__sadoku/documents/:documentId/comments/:commentId/reopen",
    (context) => {
      const { source } = resolveDocument(context.req.param("documentId"));
      return setCommentResolution(
        source,
        commentsStore,
        Number(context.req.param("commentId")),
        false,
      );
    },
  );
  app.post(
    "/__sadoku/documents/:documentId/comments/:commentId/replies",
    (context) => {
      const { source } = resolveDocument(context.req.param("documentId"));
      return createReply(
        context.req.raw,
        source,
        commentsStore,
        Number(context.req.param("commentId")),
      );
    },
  );
  app.put(
    "/__sadoku/documents/:documentId/comments/:commentId/replies/:replyId",
    (context) => {
      const { source } = resolveDocument(context.req.param("documentId"));
      return updateReply(
        context.req.raw,
        source,
        commentsStore,
        Number(context.req.param("commentId")),
        Number(context.req.param("replyId")),
      );
    },
  );
  app.delete(
    "/__sadoku/documents/:documentId/comments/:commentId/replies/:replyId",
    (context) => {
      const { source } = resolveDocument(context.req.param("documentId"));
      return deleteReply(
        source,
        commentsStore,
        Number(context.req.param("commentId")),
        Number(context.req.param("replyId")),
      );
    },
  );
  app.all("/__sadoku/documents/:documentId/comments", methodNotAllowedResponse);
  app.all(
    "/__sadoku/documents/:documentId/comments/*",
    methodNotAllowedResponse,
  );

  app.get(
    "/assets/*",
    (context) => handlePreviewAssetRequest(new URL(context.req.url).pathname),
  );
  app.all("/__sadoku", () => notFoundResponse());
  app.all("/__sadoku/*", () => notFoundResponse());
  app.all("/assets*", () => notFoundResponse("Asset not found."));
  app.get("*", () => noStoreHtml(renderSpaShell("Sadoku")));
  return (request) => app.fetch(request);
};
