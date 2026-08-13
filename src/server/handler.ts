import { Hono } from "@hono/hono/quick";

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
import {
  type CommentsStore,
  fileCommentsStore,
} from "./storage/comment/storage.ts";
import { handlePreviewAssetRequest } from "./preview/assets.ts";
import { handlePreviewDocumentRequest } from "./preview/document.ts";
import { createPreviewEventStream } from "./preview/events.ts";
import { renderSpaShell } from "./preview/shell.ts";
import {
  methodNotAllowedResponse,
  notFoundResponse,
  textResponse,
} from "./responses.ts";
import { getSettings, updateSettings } from "./api/settings_api.ts";
import {
  createPreviewSource,
  type PreviewSource,
  sourceTitle,
} from "./source.ts";

export type PreviewHandlerOptions = {
  commentsNotificationPath?: string;
  commentsStore?: CommentsStore;
  onEventStreamClose?: () => void;
  onEventStreamOpen?: () => void;
};

const handleHotReloadEventRequest = (
  documentSource: string | undefined,
  request: Request,
  options: PreviewHandlerOptions,
): Response =>
  new Response(
    createPreviewEventStream(documentSource, request.signal, options),
    {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        "connection": "keep-alive",
      },
    },
  );

const handleRemoteEventRequest = (
  request: Request,
  options: PreviewHandlerOptions,
): Response => handleHotReloadEventRequest(undefined, request, options);

export const createPreviewApp = (
  input: string | PreviewSource,
  options: PreviewHandlerOptions = {},
): Hono => {
  const previewSource = typeof input === "string"
    ? createPreviewSource(input)
    : input;
  const app = new Hono();

  app.use("*", async (_context, next) => {
    try {
      await next();
    } catch (error) {
      if (error instanceof Response) return error;
      const message = error instanceof Error ? error.message : String(error);
      return textResponse(`Failed to render Markdown: ${message}`, 500);
    }
  });

  app.get("/__sadoku/events", (context) => {
    const request = context.req.raw;
    if (previewSource.isRemote) {
      return handleRemoteEventRequest(request, options);
    }
    return handleHotReloadEventRequest(
      previewSource.documentSource,
      request,
      options,
    );
  });

  app.get(
    "/__sadoku/document",
    () => handlePreviewDocumentRequest(previewSource.documentSource),
  );

  const handleSettings = async (handle: () => Response | Promise<Response>) => {
    try {
      return await handle();
    } catch {
      return textResponse("Failed to access Sadoku settings.", 500);
    }
  };
  app.get("/__sadoku/settings", () => handleSettings(getSettings));
  app.put(
    "/__sadoku/settings",
    (context) => handleSettings(() => updateSettings(context.req.raw)),
  );
  app.all("/__sadoku/settings", methodNotAllowedResponse);

  const commentsStore = options.commentsStore ?? fileCommentsStore;
  // Preserve the comments API's original identifier contract: route segments
  // are converted with Number(), and any value that does not match a stored ID
  // is handled by the use case as a missing comment or reply.
  app.get(
    "/__sadoku/comments",
    () => getComments(previewSource, commentsStore),
  );
  app.post(
    "/__sadoku/comments",
    (context) => createComment(context.req.raw, previewSource, commentsStore),
  );
  app.put(
    "/__sadoku/comments/:commentId",
    (context) =>
      updateComment(
        context.req.raw,
        previewSource,
        commentsStore,
        Number(context.req.param("commentId")),
      ),
  );
  app.delete(
    "/__sadoku/comments/:commentId",
    (context) =>
      deleteComment(
        previewSource,
        commentsStore,
        Number(context.req.param("commentId")),
      ),
  );
  app.all("/__sadoku/comments/:commentId", methodNotAllowedResponse);
  app.get(
    "/__sadoku/comments/",
    () => notFoundResponse("Comment not found."),
  );
  app.post(
    "/__sadoku/comments/:commentId/resolve",
    (context) =>
      setCommentResolution(
        previewSource,
        commentsStore,
        Number(context.req.param("commentId")),
        true,
      ),
  );
  app.post(
    "/__sadoku/comments/:commentId/reopen",
    (context) =>
      setCommentResolution(
        previewSource,
        commentsStore,
        Number(context.req.param("commentId")),
        false,
      ),
  );
  app.post(
    "/__sadoku/comments/:commentId/replies",
    (context) =>
      createReply(
        context.req.raw,
        previewSource,
        commentsStore,
        Number(context.req.param("commentId")),
      ),
  );
  app.put(
    "/__sadoku/comments/:commentId/replies/:replyId",
    (context) =>
      updateReply(
        context.req.raw,
        previewSource,
        commentsStore,
        Number(context.req.param("commentId")),
        Number(context.req.param("replyId")),
      ),
  );
  app.delete(
    "/__sadoku/comments/:commentId/replies/:replyId",
    (context) =>
      deleteReply(
        previewSource,
        commentsStore,
        Number(context.req.param("commentId")),
        Number(context.req.param("replyId")),
      ),
  );

  const handleAsset = (request: Request) =>
    handlePreviewAssetRequest(new URL(request.url).pathname);
  app.get("/assets/*", (context) => handleAsset(context.req.raw));

  // Internal and asset URLs never fall through to the SPA. Outside the legacy
  // comments contract above, unsupported methods use the normal route-mismatch
  // contract and therefore return 404.
  app.all("/__sadoku", () => notFoundResponse());
  app.all("/__sadoku/*", () => notFoundResponse());
  app.all("/assets", () => notFoundResponse("Asset not found."));
  app.all("/assets/*", () => notFoundResponse("Asset not found."));

  app.get("*", () =>
    new Response(
      renderSpaShell(sourceTitle(previewSource.documentSource)),
      {
        headers: { "content-type": "text/html; charset=utf-8" },
      },
    ));

  app.onError((error) => {
    const message = error instanceof Error ? error.message : String(error);
    return textResponse(`Failed to render Markdown: ${message}`, 500);
  });

  return app;
};

export const createPreviewHandler = (
  input: string | PreviewSource,
  options: PreviewHandlerOptions = {},
): Deno.ServeHandler => {
  const app = createPreviewApp(input, options);
  return (request) => app.fetch(request);
};
