import { parseArgs as parseCliArgs } from "@std/cli/parse-args";
export { version } from "../version.ts";

export type CliOptions = {
  asBot: boolean;
  command?:
    | "start"
    | "comments-add"
    | "comments-inspect"
    | "comments-list"
    | "comments-reply"
    | "comments-resolve"
    | "comments-rm";
  commentId?: string;
  commentIds?: string[];
  commentBody?: string;
  endLine?: number;
  file: string | undefined;
  force: boolean;
  host: string;
  keepAlive: boolean;
  open: boolean;
  port: number;
  replyBody?: string;
  startLine?: number;
  help?: boolean;
  version?: boolean;
};

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export const usage = `Usage:
  sadoku start <file.md|url> [--port <port>] [--host <host>] [--no-open] [--keep-alive]
  sadoku comments add <file.md|url> <start-line> <end-line> <body> [--as-bot]
  sadoku comments inspect <file.md|url>
  sadoku comments reply <file.md|url> <comment-id> <body> [--as-bot]
  sadoku comments resolve <file.md|url> <comment-id>...
  sadoku comments list
  sadoku comments rm <file.md|url> [--force]

Options:
  -p, --port   Starting port to bind. Defaults to 3334.
  --host       Host to bind. Defaults to 127.0.0.1.
  --no-open    Do not open the preview in your browser automatically.
  --keep-alive Keep the server running after the browser tab is closed.
  --force      Remove comments without prompting.
  --as-bot     Attribute new comments and replies to a bot.
  -v, --version
               Show version.
  -h, --help   Show this help message.
`;

export const parseArgs = (argv: string[]): CliOptions => {
  let flags: ReturnType<typeof parseCliArgs>;
  try {
    flags = parseCliArgs(argv, {
      alias: {
        h: "help",
        p: "port",
        v: "version",
      },
      boolean: ["as-bot", "force", "help", "keep-alive", "no-open", "version"],
      default: {
        host: "127.0.0.1",
        port: "3334",
      },
      string: ["host", "port"],
      unknown: (arg) => {
        if (!arg.startsWith("-")) return true;
        throw new CliUsageError(`Unknown option: ${arg}`);
      },
    });
  } catch (error) {
    throw new CliUsageError(
      error instanceof Error ? error.message : String(error),
    );
  }

  const rejectCommentCommandPreviewOptions = (
    command: string,
    allowAsBot = false,
  ): void => {
    if (
      flags.host !== "127.0.0.1" || flags.port !== "3334" ||
      flags["keep-alive"] || flags["no-open"] ||
      (!allowAsBot && flags["as-bot"])
    ) {
      throw new CliUsageError(
        `${command} does not accept preview options.`,
      );
    }
  };

  if (flags._[0]?.toString() === "comments") {
    if (
      flags._.length >= 6 &&
      flags._[1]?.toString() === "add"
    ) {
      rejectCommentCommandPreviewOptions("comments add", true);
      const startLine = Number(flags._[3]);
      const endLine = Number(flags._[4]);
      if (!Number.isInteger(startLine) || startLine < 1) {
        throw new CliUsageError(
          "Comment start line must be a positive integer.",
        );
      }
      if (!Number.isInteger(endLine) || endLine < startLine) {
        throw new CliUsageError(
          "Comment end line must be an integer greater than or equal to the start line.",
        );
      }
      return {
        asBot: Boolean(flags["as-bot"]),
        command: "comments-add",
        commentBody: flags._.slice(5).map(String).join(" "),
        endLine,
        file: flags._[2]?.toString(),
        force: false,
        host: "127.0.0.1",
        keepAlive: false,
        open: true,
        port: 3334,
        startLine,
      };
    }

    if (
      flags._.length === 2 &&
      flags._[1]?.toString() === "list"
    ) {
      rejectCommentCommandPreviewOptions("comments list");

      const options: CliOptions = {
        asBot: false,
        command: "comments-list",
        file: undefined,
        force: false,
        host: "127.0.0.1",
        keepAlive: false,
        open: true,
        port: 3334,
      };
      if (flags.help) options.help = true;
      if (flags.version) options.version = true;
      return options;
    }

    if (
      flags._.length === 3 &&
      flags._[1]?.toString() === "rm"
    ) {
      rejectCommentCommandPreviewOptions("comments rm");

      const options: CliOptions = {
        asBot: false,
        command: "comments-rm",
        file: flags._[2]?.toString(),
        force: Boolean(flags.force),
        host: "127.0.0.1",
        keepAlive: false,
        open: true,
        port: 3334,
      };
      if (flags.help) options.help = true;
      if (flags.version) options.version = true;
      return options;
    }

    if (
      flags._.length === 3 &&
      flags._[1]?.toString() === "inspect"
    ) {
      rejectCommentCommandPreviewOptions("comments inspect");

      const options: CliOptions = {
        asBot: false,
        command: "comments-inspect",
        file: flags._[2]?.toString(),
        force: false,
        host: "127.0.0.1",
        keepAlive: false,
        open: true,
        port: 3334,
      };
      if (flags.help) options.help = true;
      if (flags.version) options.version = true;
      return options;
    }

    if (
      flags._.length >= 5 &&
      flags._[1]?.toString() === "reply"
    ) {
      rejectCommentCommandPreviewOptions("comments reply", true);

      const options: CliOptions = {
        asBot: Boolean(flags["as-bot"]),
        command: "comments-reply",
        commentId: flags._[3]?.toString(),
        file: flags._[2]?.toString(),
        force: false,
        host: "127.0.0.1",
        keepAlive: false,
        open: true,
        port: 3334,
        replyBody: flags._.slice(4).map(String).join(" "),
      };
      if (flags.help) options.help = true;
      if (flags.version) options.version = true;
      return options;
    }

    if (
      flags._.length >= 4 &&
      flags._[1]?.toString() === "resolve"
    ) {
      rejectCommentCommandPreviewOptions("comments resolve");

      const options: CliOptions = {
        asBot: false,
        command: "comments-resolve",
        commentIds: flags._.slice(3).map(String),
        file: flags._[2]?.toString(),
        force: false,
        host: "127.0.0.1",
        keepAlive: false,
        open: true,
        port: 3334,
      };
      if (flags.help) options.help = true;
      if (flags.version) options.version = true;
      return options;
    }

    throw new CliUsageError("Invalid comments command.");
  }

  if (flags["as-bot"]) {
    throw new CliUsageError(
      "--as-bot is only accepted by comments add and comments reply.",
    );
  }

  if (flags._.length > 0 && flags._[0]?.toString() !== "start") {
    throw new CliUsageError(`Invalid command: ${flags._[0]}`);
  }

  if (flags._.length > 2) {
    throw new CliUsageError(
      "Only one Markdown file can be previewed at a time.",
    );
  }

  if (flags.host === "") throw new CliUsageError("--host requires a value.");
  if (flags.port === "") throw new CliUsageError("--port requires a value.");

  const port = Number(flags.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new CliUsageError(`Invalid port: ${flags.port}`);
  }

  const options: CliOptions = {
    asBot: Boolean(flags["as-bot"]),
    command: flags._[0]?.toString() === "start" ? "start" : undefined,
    file: flags._[1]?.toString(),
    force: false,
    host: flags.host?.toString() ?? "127.0.0.1",
    keepAlive: Boolean(flags["keep-alive"]),
    open: !flags["no-open"],
    port,
  };
  if (flags.help) options.help = true;
  if (flags.version) options.version = true;

  return options;
};
