import { Hono } from "@hono/hono";

import { handleCommentsRequest } from "./comments/handler.ts";
import type { CommentsStore } from "./comments/storage.ts";
import { handlePreviewAssetRequest } from "./preview/assets.ts";
import { handlePreviewDocumentRequest } from "./preview/document.ts";
import { createPreviewEventStream } from "./preview/events.ts";
import { renderSpaShell } from "./preview/shell.ts";
import { notFoundResponse, textResponse } from "./responses.ts";
import { handleSettingsRequest } from "./settings/handler.ts";
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

  const handleSettings = async (request: Request) => {
    try {
      return await handleSettingsRequest(request);
    } catch {
      return textResponse("Failed to access Sadoku settings.", 500);
    }
  };
  app.get("/__sadoku/settings", (context) => handleSettings(context.req.raw));
  app.put("/__sadoku/settings", (context) => handleSettings(context.req.raw));

  const handleComments = (request: Request) =>
    handleCommentsRequest(
      request,
      previewSource,
      new URL(request.url).pathname,
      options.commentsStore,
    );
  app.get("/__sadoku/comments", (context) => handleComments(context.req.raw));
  app.post("/__sadoku/comments", (context) => handleComments(context.req.raw));
  app.put(
    "/__sadoku/comments/:commentId",
    (context) => handleComments(context.req.raw),
  );
  app.delete(
    "/__sadoku/comments/:commentId",
    (context) => handleComments(context.req.raw),
  );
  app.post(
    "/__sadoku/comments/:commentId/resolve",
    (context) => handleComments(context.req.raw),
  );
  app.post(
    "/__sadoku/comments/:commentId/reopen",
    (context) => handleComments(context.req.raw),
  );
  app.post(
    "/__sadoku/comments/:commentId/replies",
    (context) => handleComments(context.req.raw),
  );
  app.put(
    "/__sadoku/comments/:commentId/replies/:replyId",
    (context) => handleComments(context.req.raw),
  );
  app.delete(
    "/__sadoku/comments/:commentId/replies/:replyId",
    (context) => handleComments(context.req.raw),
  );

  // Preserve the comments API's existing 405 response (without an Allow
  // header) after declaring every supported method above. The comments
  // handler also retains its resource-specific 404 responses for malformed
  // and unknown comment subpaths.
  app.all("/__sadoku/comments", (context) => handleComments(context.req.raw));
  app.all("/__sadoku/comments/*", (context) => handleComments(context.req.raw));

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
