import { runCli } from "./cli/cli.ts";
import { startPreviewServer } from "./server.ts";

export const runApp = (argv: string[]): Promise<number> =>
  runCli(argv, { startPreviewServer });
