import { runCli } from "./cli/cli.ts";
import { readConfig } from "./config.ts";
import { startPreviewServer } from "./server.ts";

export const runApp = (argv: string[]): Promise<number> =>
  runCli(argv, {
    getDefaultDirectory: () => readConfig()?.defaultDirectory,
    startPreviewServer,
  });
