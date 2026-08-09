import { Hono } from "@hono/hono";

import { handleCommentsRequest } from "./comments/handler.ts";
import type { CommentsStore } from "./comments/storage.ts";
import { handlePreviewAssetRequest } from "./preview/assets.ts";
import { handlePreviewDocumentRequest } from "./preview/document.ts";
import { createPreviewEventStream } from "./preview/events.ts";
import { renderSpaShell } from "./preview/shell.ts";
import { textResponse } from "./responses.ts";
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

  app.all("/__sadoku/events", (context) => {
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

  app.all(
    "/__sadoku/document",
    () => handlePreviewDocumentRequest(previewSource.documentSource),
  );

  app.all("/__sadoku/settings", async (context) => {
    try {
      return await handleSettingsRequest(context.req.raw);
    } catch {
      return textResponse("Failed to access Sadoku settings.", 500);
    }
  });

  const handleComments = (request: Request) =>
    handleCommentsRequest(
      request,
      previewSource,
      new URL(request.url).pathname,
      options.commentsStore,
    );
  app.all("/__sadoku/comments", (context) => handleComments(context.req.raw));
  app.all("/__sadoku/comments/*", (context) => handleComments(context.req.raw));

  const handleAsset = (request: Request) =>
    handlePreviewAssetRequest(new URL(request.url).pathname);
  app.all("/assets/", (context) => handleAsset(context.req.raw));
  app.all("/assets/*", (context) => handleAsset(context.req.raw));

  app.all("*", () =>
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
