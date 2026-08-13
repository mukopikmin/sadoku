#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-run --allow-env=BROWSER,HOME,XDG_CONFIG_HOME,XDG_DATA_HOME,APPDATA,SADOKU_COMMENTS_DIR,MDVIEW_COMMENTS_DIR
import { CliUsageError, parseArgs, usage, version } from "./cli/args.ts";
import { openBrowser } from "./cli/browser.ts";
import { checkForUpdate, installUpdate } from "./cli/update.ts";
import {
  addComment,
  formatCommentFilesTable,
  inspectComments,
  listCommentFiles,
  removeComments,
  removeCommentsIfConfirmed,
  replyToComment,
  resolveComments,
} from "./server/cli/comment_cli.ts";
import { logInfo } from "./log.ts";
import { startPreviewServer } from "./server/mod.ts";
import { createConfiguredCommentsStore } from "./server/storage/comment/factory.ts";

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

const main = async (): Promise<void> => {
  const options = parseArgs(Deno.args);

  if (options.help) {
    console.log(usage);
    return;
  }

  if (options.version) {
    console.log(`sadoku ${version}`);
    return;
  }

  if (options.command === "update") {
    const plan = await checkForUpdate(version, options.channel);
    console.log(`Current version: ${plan.currentVersion}`);
    console.log(`Update channel: ${plan.channel}`);
    console.log(`Available version: ${plan.targetVersion}`);
    if (!plan.updateAvailable) {
      console.log(`Already up to date: ${plan.targetVersion}`);
      return;
    }
    if (!confirm(`Update Sadoku to ${plan.targetVersion}?`)) {
      console.log("Update cancelled.");
      return;
    }
    const result = await installUpdate(plan);
    console.log(`Updated to: ${result.targetVersion}`);
    return;
  }

  if (options.command === "comments-list") {
    const result = await withCommentsStore((commentsStore) =>
      listCommentFiles({ commentsStore })
    );
    for (const warning of result.warnings) {
      console.error(`Warning: ${warning}`);
    }
    console.log(formatCommentFilesTable(result.entries).trimEnd());
    return;
  }

  if (options.command === "comments-inspect") {
    if (!options.file) {
      throw new CliUsageError("Missing Markdown file.");
    }
    console.log(
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
    console.log(JSON.stringify(
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
    console.log(
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
    console.log(
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
      const answer = prompt(`Remove comments for ${options.file}? [y/N]`);
      filePath = await withCommentsStore((commentsStore) =>
        removeCommentsIfConfirmed(options.file!, answer ?? "", {
          commentsStore,
        })
      );
      if (!filePath) {
        console.log("Not removed.");
        return;
      }
    }

    console.log(`Removed comments for ${filePath}`);
    return;
  }

  if (!options.file) {
    throw new CliUsageError("Missing Markdown file.");
  }

  const preview = await startPreviewServer({
    file: options.file,
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

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (error instanceof CliUsageError) {
    console.error(usage);
  }
  Deno.exitCode = 1;
}
