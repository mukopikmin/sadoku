import {
  type CliOptions,
  CliUsageError,
  parseArgs,
  usage,
  version,
} from "./args.ts";
import { openBrowser } from "./browser.ts";
import { checkForUpdate, installUpdate } from "./update.ts";
import {
  addComment,
  formatCommentFilesTable,
  inspectComments,
  listCommentFiles,
  removeComments,
  removeCommentsIfConfirmed,
  replyToComment,
  resolveComments,
} from "./comment_cli.ts";
import { logInfo } from "../../log.ts";
import type { PreviewServerOptions } from "../server.ts";
import { createConfiguredCommentsStore } from "../storage/comment/factory.ts";
import { createPreviewSource } from "../source.ts";

export type CliDependencies = {
  getDefaultDirectory(): string | undefined;
  startPreviewServer(
    options: PreviewServerOptions,
  ): Promise<{ filePath: string; url: string }>;
};

export type CliIo = {
  confirm(message: string): boolean;
  error(message: string): void;
  log(message: string): void;
  prompt(message: string): string | null;
};

const defaultCliIo: CliIo = {
  confirm,
  error: (message) => console.error(message),
  log: (message) => console.log(message),
  prompt,
};

const withCommentsStore = async <T>(
  operation: (
    commentsStore: Awaited<ReturnType<typeof createConfiguredCommentsStore>>,
  ) => Promise<T>,
): Promise<T> => {
  const commentsStore = await createConfiguredCommentsStore();
  try {
    return await operation(commentsStore);
  } finally {
    commentsStore.close();
  }
};

const isCommentCommand = (command: CliOptions["command"]): boolean => {
  switch (command) {
    case "comments-add":
    case "comments-inspect":
    case "comments-list":
    case "comments-reply":
    case "comments-resolve":
    case "comments-rm":
      return true;
    case "start":
    case "update":
    case undefined:
      return false;
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
};

const executeCli = async (
  argv: string[],
  dependencies: CliDependencies,
  io: CliIo,
): Promise<void> => {
  const options = parseArgs(argv);

  if (isCommentCommand(options.command) && options.file) {
    const source = createPreviewSource(options.file);
    if (!source.isRemote) {
      const stat = await Deno.stat(source.documentSource).catch(() =>
        undefined
      );
      if (stat?.isDirectory) {
        throw new CliUsageError(
          "Comment commands require a Markdown file or URL.",
        );
      }
    }
  }

  if (options.help) {
    io.log(usage);
    return;
  }

  if (options.version) {
    io.log(`sadoku ${version}`);
    return;
  }

  if (options.command === "update") {
    const plan = await checkForUpdate(version, options.channel);
    io.log(`Current version: ${plan.currentVersion}`);
    io.log(`Update channel: ${plan.channel}`);
    io.log(`Available version: ${plan.targetVersion}`);
    if (!plan.updateAvailable) {
      io.log(`Already up to date: ${plan.targetVersion}`);
      return;
    }
    if (!io.confirm(`Update Sadoku to ${plan.targetVersion}?`)) {
      io.log("Update cancelled.");
      return;
    }
    const result = await installUpdate(plan);
    io.log(`Updated to: ${result.targetVersion}`);
    return;
  }

  if (options.command === "comments-list") {
    const result = await withCommentsStore((commentsStore) =>
      listCommentFiles({ commentsStore })
    );
    for (const warning of result.warnings) {
      io.error(`Warning: ${warning}`);
    }
    io.log(formatCommentFilesTable(result.entries).trimEnd());
    return;
  }

  if (options.command === "comments-inspect") {
    if (!options.file) {
      throw new CliUsageError("Missing Markdown file.");
    }
    io.log(
      JSON.stringify(
        await withCommentsStore((commentsStore) =>
          inspectComments(options.file!, { commentsStore })
        ),
        null,
        2,
      ),
    );
    return;
  }

  if (options.command === "comments-add") {
    if (!options.file) throw new CliUsageError("Missing Markdown file.");
    io.log(JSON.stringify(
      await withCommentsStore((commentsStore) =>
        addComment(
          options.file!,
          options.startLine ?? 0,
          options.endLine ?? 0,
          options.commentBody ?? "",
          { asBot: options.asBot, commentsStore },
        )
      ),
      null,
      2,
    ));
    return;
  }

  if (options.command === "comments-resolve") {
    if (!options.file) {
      throw new CliUsageError("Missing Markdown file.");
    }
    io.log(
      JSON.stringify(
        await withCommentsStore((commentsStore) =>
          resolveComments(options.file!, options.commentIds ?? [], {
            asBot: options.asBot,
            commentsStore,
          })
        ),
        null,
        2,
      ),
    );
    return;
  }

  if (options.command === "comments-reply") {
    if (!options.file) {
      throw new CliUsageError("Missing Markdown file.");
    }
    if (!options.commentId) {
      throw new CliUsageError("Missing comment ID.");
    }
    io.log(
      JSON.stringify(
        await withCommentsStore((commentsStore) =>
          replyToComment(
            options.file!,
            options.commentId!,
            options.replyBody ?? "",
            {
              asBot: options.asBot,
              requestReview: options.requestReview,
              commentsStore,
            },
          )
        ),
        null,
        2,
      ),
    );
    return;
  }

  if (options.command === "comments-rm") {
    if (!options.file) {
      throw new CliUsageError("Missing Markdown file.");
    }

    let filePath: string | undefined;
    if (options.force) {
      filePath = await withCommentsStore((commentsStore) =>
        removeComments(options.file!, { commentsStore })
      );
    } else {
      const answer = io.prompt(`Remove comments for ${options.file}? [y/N]`);
      filePath = await withCommentsStore((commentsStore) =>
        removeCommentsIfConfirmed(options.file!, answer ?? "", {
          commentsStore,
        })
      );
      if (!filePath) {
        io.log("Not removed.");
        return;
      }
    }

    io.log(`Removed comments for ${filePath}`);
    return;
  }

  const file = options.file ??
    (options.command === "start"
      ? dependencies.getDefaultDirectory()
      : undefined);
  if (!file) {
    throw new CliUsageError("Missing Markdown file.");
  }

  const preview = await dependencies.startPreviewServer({
    file,
    host: options.host,
    keepAlive: options.keepAlive,
    port: options.port,
  });

  logInfo(`Serving ${preview.filePath}`);
  logInfo(`Preview: ${preview.url}`);

  if (options.open) {
    await openBrowser(preview.url);
  }
};

export const runCli = async (
  argv: string[],
  dependencies: CliDependencies,
  io: CliIo = defaultCliIo,
): Promise<number> => {
  try {
    await executeCli(argv, dependencies, io);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.error(message);
    if (error instanceof CliUsageError) {
      io.error(usage);
    }
    return 1;
  }
};
