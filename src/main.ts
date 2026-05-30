#!/usr/bin/env -S deno run --allow-read --allow-net --allow-run
import { CliUsageError, parseArgs, usage, version } from "./cli/args.ts";
import { openBrowser } from "./cli/browser.ts";
import { startPreviewServer } from "./preview/server.ts";

const main = async (): Promise<void> => {
  const options = parseArgs(Deno.args);

  if (options.help) {
    console.log(usage);
    return;
  }

  if (options.version) {
    console.log(`mdview ${version}`);
    return;
  }

  if (!options.file) {
    throw new CliUsageError("Missing Markdown file.");
  }

  const preview = await startPreviewServer({
    file: options.file,
    host: options.host,
    port: options.port,
  });

  console.log(`Serving ${preview.filePath}`);
  console.log(`Preview: ${preview.url}`);

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
