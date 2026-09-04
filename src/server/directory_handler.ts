import { Hono } from "@hono/hono/quick";
import type { Context, Next } from "@hono/hono";
import {
  createComment,
  createReply,
  deleteComment,
  deleteReply,
  getComments,
  setCommentResolution,
  updateComment,
  updateReply,
} from "./api/comment_api.ts";
import type { CommentsStore } from "./storage/comment/storage.ts";
import type {
  DirectoryDocument,
  DirectorySession,
} from "./usecase/document/mod.ts";
import type { DocumentStore } from "./usecase/document/mod.ts";
import { createPreviewSource } from "./source.ts";
import { handlePreviewAssetRequest } from "./preview/assets.ts";
import { handlePreviewDocumentRequest } from "./preview/document.ts";
import { createPreviewEventStream } from "./preview/events.ts";
import { renderSpaShell } from "./preview/shell.ts";
import { getCommentsNotificationFilePath } from "./storage/comment/notifications.ts";
import {
  methodNotAllowedResponse,
  noStoreJson,
  notFoundResponse,
  textResponse,
} from "./responses.ts";
import { getSettings, updateSettings } from "./api/settings_api.ts";
import { getDatabaseStatistics } from "./api/statistics_api.ts";
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

export type DirectoryPreviewHandlerOptions = {
  log?: (message: string) => void;
  onEventStreamClose?: () => void;
  onEventStreamOpen?: () => void;
  statistics?: StatisticsReader;
  directoryState?: DirectorySessionState;
};

const findDocument = (
  session: DirectorySession,
  rawId: string,
): DirectoryDocument | undefined => {
  if (!/^[1-9]\d*$/.test(rawId)) return undefined;
  const id = Number(rawId);
  return Number.isSafeInteger(id) ? session.documentsById.get(id) : undefined;
};

export const createDirectoryPreviewHandler = (
  session: DirectorySession,
  commentsStore: CommentsStore,
  options: DirectoryPreviewHandlerOptions = {},
  documentStore?: DocumentStore,
  instructionStore?: InstructionStore,
  tagStore?: TagStore,
): Deno.ServeHandler => {
  const app = new Hono();
  const log = options.log ?? logInfo;
  const resolveDocument = (rawId: string) => {
    const document = findDocument(session, rawId);
    if (!document) throw notFoundResponse("Document not found.");
    return { document, source: createPreviewSource(document.filePath) };
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
    async () =>
      noStoreJson(
        await Promise.all(session.documents.map(
          async ({ deleted, id, relativePath, title }) => ({
            deleted,
            id,
            relativePath,
            title,
            ...(tagStore && {
              tags: (await tagStore.listForDocument(id)).map((
                { backgroundColor, id, name },
              ) => ({
                backgroundColor,
                id,
                name,
              })),
            }),
          }),
        )),
      ),
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
  if (options.statistics) {
    app.get(
      "/__sadoku/statistics",
      () => getDatabaseStatistics(options.statistics!),
    );
    app.all("/__sadoku/statistics", methodNotAllowedResponse);
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
  app.get("/__sadoku/documents/:documentId", async (context) => {
    const { document, source } = resolveDocument(
      context.req.param("documentId"),
    );
    let body: { fileUrl?: string; markdown: string; title?: string };
    if (document.deleted) {
      const markdown = await documentStore?.readSnapshot?.(document.id);
      if (markdown === undefined) {
        throw notFoundResponse("Saved Markdown snapshot not found.");
      }
      body = { markdown };
    } else {
      const response = await handlePreviewDocumentRequest(
        source.documentSource,
      );
      body = await response.json();
      await documentStore?.initializeSnapshot?.(document.id, body.markdown);
    }
    return noStoreJson({
      id: document.id,
      relativePath: document.relativePath,
      title: document.title,
      deleted: document.deleted,
      fileUrl: body.fileUrl,
      markdown: body.markdown,
      ...(tagStore && {
        tags: (await tagStore.listForDocument(document.id)).map(
          ({ backgroundColor, id, name }) => ({ backgroundColor, id, name }),
        ),
      }),
    });
  });

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
    return getComments(source, commentsStore);
  });
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
  app.post("/__sadoku/documents/:documentId/comments", (context) => {
    const { source } = resolveDocument(context.req.param("documentId"));
    return createComment(context.req.raw, source, commentsStore);
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
  app.get("*", () =>
    new Response(renderSpaShell("Sadoku"), {
      headers: { "content-type": "text/html; charset=utf-8" },
    }));
  return (request) => app.fetch(request);
};
