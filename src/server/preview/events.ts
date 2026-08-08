import { dirname, resolve } from "@std/path";
import { formatLogMessage } from "../../log.ts";

export type EventStreamOptions = {
  commentsNotificationPath?: string;
  onEventStreamClose?: () => void;
  onEventStreamOpen?: () => void;
};

const encoder = new TextEncoder();
const invalidationEvent = (resources: string[]) =>
  encoder.encode(
    `event: invalidate\ndata: ${JSON.stringify({ resources })}\n\n`,
  );

export const formatPreviewReloadLog = (
  filePath: string,
  timestamp: Date,
): string =>
  formatLogMessage(
    `Reloading preview after Markdown change: ${filePath}`,
    timestamp,
  );

export const logPreviewReload = (filePath: string): void => {
  console.log(formatPreviewReloadLog(filePath, new Date()));
};

export const createPreviewEventStream = (
  filePath: string | undefined,
  signal: AbortSignal,
  options: EventStreamOptions = {},
): ReadableStream<Uint8Array> => {
  const watchers: Deno.FsWatcher[] = [];
  let close: (() => void) | undefined;
  let closed = false;

  const closeOnce = (controller?: ReadableStreamDefaultController) => {
    if (closed) return;
    closed = true;
    for (const watcher of watchers) watcher.close();
    options.onEventStreamClose?.();
    if (!controller) return;
    try {
      controller.close();
    } catch {
      // The stream may already be closed if the client disconnected.
    }
  };

  return new ReadableStream({
    start(controller) {
      options.onEventStreamOpen?.();
      close = () => closeOnce(controller);
      signal.addEventListener("abort", close, { once: true });

      const watch = (
        targetPath: string,
        resources: string[],
        logChange?: () => void,
      ) =>
        (async () => {
          const resolvedTargetPath = resolve(targetPath);
          const watcher = Deno.watchFs(dirname(resolvedTargetPath));
          watchers.push(watcher);
          try {
            for await (const event of watcher) {
              if (
                event.kind === "access" ||
                !event.paths.some((path) =>
                  resolve(path) === resolvedTargetPath
                )
              ) {
                continue;
              }

              logChange?.();
              controller.enqueue(invalidationEvent(resources));
            }
          } catch (error) {
            if (!signal.aborted) {
              controller.error(error);
              closeOnce();
            }
          }
        })();

      const tasks: Promise<void>[] = [];
      if (filePath) {
        tasks.push(watch(filePath, ["document", "comments"], () => {
          logPreviewReload(filePath);
        }));
      }
      if (options.commentsNotificationPath) {
        tasks.push(watch(options.commentsNotificationPath, ["comments"]));
      }
      Promise.all(tasks).finally(() => {
        if (close) signal.removeEventListener("abort", close);
      });
    },
    cancel() {
      closeOnce();
    },
  });
};
