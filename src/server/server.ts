import { formatLogMessage, logError, logInfo } from "../log.ts";
import { createConfiguredStores } from "./storage/factory.ts";
import { createPreviewSource, readMarkdownSource } from "./source.ts";
import {
  createLoadingDirectorySession,
  createPreviewSession,
  prepareDirectorySession,
} from "./directory_session.ts";
import { createDirectoryPreviewHandler } from "./directory_handler.ts";
import { readConfig } from "./config.ts";
import { initializeSnapshotQueue } from "./preview/snapshot_queue.ts";

export type PreviewServerOptions = {
  file: string;
  host: string;
  keepAlive?: boolean;
  log?: (message: string) => void;
  maxDepth?: number;
  maxFiles?: number;
  port: number;
};

export type StartedPreviewServer = {
  filePath: string;
  url: string;
  server: Deno.HttpServer<Deno.NetAddr>;
};

type PreviewShutdownSchedulerOptions = {
  delayMs?: number;
  filePath: string;
  keepAlive?: boolean;
  shutdown: () => Promise<void>;
};

export const createPreviewShutdownScheduler = (
  options: PreviewShutdownSchedulerOptions,
): {
  onEventStreamClose: () => void;
  onEventStreamOpen: () => void;
} => {
  let eventStreamCount = 0;
  let shutdownTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleShutdown = () => {
    if (
      options.keepAlive || eventStreamCount > 0 ||
      shutdownTimer !== undefined
    ) {
      return;
    }
    shutdownTimer = setTimeout(() => {
      shutdownTimer = undefined;
      if (eventStreamCount === 0) {
        logPreviewClosed(options.filePath);
        options.shutdown().catch((error) => {
          logError(
            `Failed to shut down after preview closed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
      }
    }, options.delayMs ?? 1000);
  };

  const cancelShutdown = () => {
    if (shutdownTimer === undefined) return;
    clearTimeout(shutdownTimer);
    shutdownTimer = undefined;
  };

  return {
    onEventStreamOpen: () => {
      if (options.keepAlive) return;
      eventStreamCount += 1;
      cancelShutdown();
    },
    onEventStreamClose: () => {
      if (options.keepAlive) return;
      eventStreamCount = Math.max(0, eventStreamCount - 1);
      scheduleShutdown();
    },
  };
};

export const formatPreviewClosedLog = (
  filePath: string,
  timestamp: Date,
): string =>
  formatLogMessage(
    `Stopping preview server after browser tab closed: ${filePath}`,
    timestamp,
  );

export const logPreviewClosed = (filePath: string): void => {
  logInfo(`Stopping preview server after browser tab closed: ${filePath}`);
};

const serveOnAvailablePort = (
  options: Pick<PreviewServerOptions, "host" | "port">,
  handler: Deno.ServeHandler<Deno.NetAddr>,
): Deno.HttpServer<Deno.NetAddr> => {
  let port = options.port;

  while (true) {
    try {
      return Deno.serve(
        {
          hostname: options.host,
          port,
          onListen: () => {
            // The CLI prints the canonical URL after startPreviewServer resolves.
          },
        },
        handler,
      );
    } catch (error) {
      if (
        !(error instanceof Deno.errors.AddrInUse) ||
        port === 0 ||
        port === 65535
      ) {
        throw error;
      }
      port += 1;
    }
  }
};

export const startPreviewServer = async (
  options: PreviewServerOptions,
): Promise<StartedPreviewServer> => {
  const previewSource = createPreviewSource(options.file);
  const isDirectory = !previewSource.isRemote &&
    (await Deno.stat(previewSource.documentSource).catch(() => undefined))
        ?.isDirectory === true;
  const config = readConfig();
  const log = options.log ?? logInfo;

  let server: Deno.HttpServer<Deno.NetAddr>;
  const preparationController = new AbortController();
  const backgroundTasks = new Set<Promise<unknown>>();
  const trackBackground = (task: Promise<unknown>) => {
    backgroundTasks.add(task);
    task.finally(() => backgroundTasks.delete(task)).catch(() => {});
  };
  const shutdownScheduler = createPreviewShutdownScheduler({
    filePath: previewSource.documentSource,
    keepAlive: options.keepAlive,
    shutdown: () => {
      preparationController.abort();
      return server.shutdown();
    },
  });

  const stores = await createConfiguredStores();
  let previewSession;
  const directoryState = isDirectory
    ? createLoadingDirectorySession(previewSource.documentSource)
    : undefined;
  try {
    previewSession = directoryState?.session ?? await createPreviewSession(
      previewSource.documentSource,
      stores.documents,
    );
  } catch (error) {
    stores.close();
    throw error;
  }
  for (const document of previewSession.documents) {
    log(
      `Registered document: id=${document.id} path=${document.filePath}${
        document.deleted ? " (saved snapshot)" : ""
      }`,
    );
  }
  server = serveOnAvailablePort(
    options,
    createDirectoryPreviewHandler(
      previewSession,
      stores.comments,
      {
        ...shutdownScheduler,
        log,
        directoryState,
        statistics: stores.statistics,
      },
      stores.documents,
      stores.instructions,
    ),
  );

  if (directoryState) {
    const preparation = prepareDirectorySession(
      directoryState,
      stores.documents,
      {
        excludedDirectories: config?.excludedDirectories,
        maxDepth: options.maxDepth ?? config?.directoryMaxDepth,
        maxFiles: options.maxFiles ?? config?.directoryMaxFiles,
      },
      preparationController.signal,
    ).then(() => {
      if (directoryState.status.state !== "ready") return;
      return initializeSnapshotQueue({
        documents: directoryState.session.documents,
        initializeSnapshot: (id, markdown) =>
          stores.documents.initializeSnapshot?.(id, markdown) ??
            Promise.resolve(),
        readMarkdown: readMarkdownSource,
        signal: preparationController.signal,
      });
    });
    trackBackground(preparation);
  }

  // Populate archival snapshots only after the server is listening so that
  // reading many documents never delays startup. The conditional database
  // update also makes this safe to race with a user's first document request.
  if (!directoryState) {
    trackBackground(initializeSnapshotQueue({
      documents: previewSession.documents,
      initializeSnapshot: (id, markdown) =>
        stores.documents.initializeSnapshot?.(id, markdown) ??
          Promise.resolve(),
      readMarkdown: readMarkdownSource,
      signal: preparationController.signal,
    }));
  }

  const pathname = isDirectory
    ? "/"
    : `/documents/${previewSession.documents[0].id}`;
  const url = `http://${server.addr.hostname}:${server.addr.port}${pathname}`;

  const shutdown = server.shutdown.bind(server);
  server.shutdown = async () => {
    preparationController.abort();
    await shutdown();
    await Promise.allSettled([...backgroundTasks]);
  };

  server.finished.finally(() => {
    preparationController.abort();
    void Promise.allSettled([...backgroundTasks]).then(() => stores.close());
  }).catch((error) => {
    if (!(error instanceof Deno.errors.Interrupted)) {
      logError(
        `Server stopped unexpectedly: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  return { filePath: previewSource.documentSource, url, server };
};
