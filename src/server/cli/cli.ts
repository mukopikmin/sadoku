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
  deleteComment,
  deleteReply,
  listDocumentComments,
  replyToComment,
  resolveComments,
  updateComment,
  updateReply,
} from "./comment_cli.ts";
import {
  addDocument,
  inspectDocument,
  listRegisteredDocuments,
} from "./document_cli.ts";
import { logInfo } from "../../log.ts";
import type { PreviewServerOptions } from "../server.ts";
import { createConfiguredStores } from "../storage/factory.ts";
import { createPreviewSource } from "../source.ts";
import type { ConfiguredStores } from "../storage/factory.ts";

export type CliDependencies = {
  startPreviewServer(options: PreviewServerOptions): Promise<{
    filePath: string;
    url: string;
  }>;
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

const printJson = (io: CliIo, value: unknown) =>
  io.log(JSON.stringify(value, null, 2));

const resolveCommentSource = async (
  options: CliOptions,
  stores: ConfiguredStores,
): Promise<string> => {
  if (options.documentId !== undefined) {
    const document = await stores.documents.findById(options.documentId);
    if (!document) throw new Error(`Document not found: ${options.documentId}`);
    return document.filePath;
  }

  const input = options.source!;
  const source = createPreviewSource(input);
  const document = await stores.documents.findByFilePath(source.commentSource);
  if (!document) {
    if (!options.ensureDocument) {
      throw new Error(
        `Document is not registered: ${source.commentSource}. Pass --ensure-document to register it.`,
      );
    }
    await stores.documents.ensure(source.commentSource);
  }
  return source.documentSource;
};

const runWithStores = async <T>(
  operation: (stores: ConfiguredStores) => Promise<T>,
): Promise<T> => {
  const stores = await createConfiguredStores();
  try {
    return await operation(stores);
  } finally {
    stores.close();
  }
};

const executeCli = async (
  argv: string[],
  dependencies: CliDependencies,
  io: CliIo,
): Promise<void> => {
  const options = parseArgs(argv);
  if (options.help) return io.log(usage);
  if (options.version) return io.log(`sadoku ${version}`);

  if (options.command === "update") {
    const plan = await checkForUpdate(version, options.channel);
    io.log(`Current version: ${plan.currentVersion}`);
    io.log(`Update channel: ${plan.channel}`);
    io.log(`Available version: ${plan.targetVersion}`);
    if (!plan.updateAvailable) {
      return io.log(`No newer version available: ${plan.targetVersion}`);
    }
    if (!io.confirm(`Update Sadoku to ${plan.targetVersion}?`)) {
      return io.log("Update cancelled.");
    }
    const result = await installUpdate(plan);
    io.log(`Updated to: ${result.targetVersion}`);
    return;
  }

  if (options.command?.startsWith("document-")) {
    await runWithStores(async (stores) => {
      if (options.command === "document-list") {
        return printJson(io, await listRegisteredDocuments(stores.documents));
      }
      if (options.command === "document-add") {
        return printJson(
          io,
          await addDocument(options.source!, stores.documents),
        );
      }
      return printJson(
        io,
        await inspectDocument(options.documentId!, stores.documents),
      );
    });
    return;
  }

  if (options.command?.startsWith("comment-")) {
    await runWithStores(async (stores) => {
      const source = await resolveCommentSource(options, stores);
      const commentOptions = {
        asBot: options.asBot,
        commentsStore: stores.comments,
        requestReview: options.requestReview,
      };
      switch (options.command) {
        case "comment-list":
          return printJson(
            io,
            await listDocumentComments(source, commentOptions),
          );
        case "comment-add":
          return printJson(
            io,
            await addComment(
              source,
              options.startLine!,
              options.endLine!,
              options.body!,
              commentOptions,
            ),
          );
        case "comment-update":
          return printJson(
            io,
            await updateComment(
              source,
              options.commentId!,
              options.body!,
              commentOptions,
            ),
          );
        case "comment-delete":
          await deleteComment(source, options.commentId!, commentOptions);
          return io.log(`Deleted comment ${options.commentId}.`);
        case "comment-resolve":
        case "comment-reopen":
          return printJson(
            io,
            await resolveComments(
              source,
              options.commentIds!.map(String),
              commentOptions,
              options.command === "comment-resolve",
            ),
          );
        case "comment-reply-add":
          return printJson(
            io,
            await replyToComment(
              source,
              String(options.commentId),
              options.body!,
              commentOptions,
            ),
          );
        case "comment-reply-update":
          return printJson(
            io,
            await updateReply(
              source,
              options.commentId!,
              options.replyId!,
              options.body!,
              commentOptions,
            ),
          );
        case "comment-reply-delete":
          await deleteReply(
            source,
            options.commentId!,
            options.replyId!,
            commentOptions,
          );
          return io.log(`Deleted reply ${options.replyId}.`);
      }
    });
    return;
  }

  if (!options.file) {
    throw new CliUsageError("Missing Markdown file or directory.");
  }
  const preview = await dependencies.startPreviewServer({
    file: options.file,
    host: options.host,
    keepAlive: options.keepAlive,
    port: options.port,
  });
  logInfo(`Serving ${preview.filePath}`);
  logInfo(`Preview: ${preview.url}`);
  if (options.open) await openBrowser(preview.url);
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
    io.error(error instanceof Error ? error.message : String(error));
    if (error instanceof CliUsageError) io.error(usage);
    return 1;
  }
};
