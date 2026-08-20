import { formatLogMessage, logError, logInfo } from "../log.ts";
import { createConfiguredStores } from "./storage/factory.ts";
import { createPreviewSource } from "./source.ts";
import { createPreviewSession } from "./directory_session.ts";
import { createDirectoryPreviewHandler } from "./directory_handler.ts";

export type PreviewServerOptions = {
  file: string;
  host: string;
  keepAlive?: boolean;
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

  let server: Deno.HttpServer<Deno.NetAddr>;
  const shutdownScheduler = createPreviewShutdownScheduler({
    filePath: previewSource.documentSource,
    keepAlive: options.keepAlive,
    shutdown: () => server.shutdown(),
  });

  const stores = await createConfiguredStores();
  let previewSession;
  try {
    previewSession = await createPreviewSession(
      previewSource.documentSource,
      stores.documents,
    );
  } catch (error) {
    stores.close();
    throw error;
  }
  server = serveOnAvailablePort(
    options,
    createDirectoryPreviewHandler(
      previewSession,
      stores.comments,
      shutdownScheduler,
    ),
  );

  const pathname = isDirectory
    ? "/"
    : `/documents/${previewSession.documents[0].id}`;
  const url = `http://${server.addr.hostname}:${server.addr.port}${pathname}`;

  server.finished.finally(() => stores.close()).catch((error) => {
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
