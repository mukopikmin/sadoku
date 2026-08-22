import { parseArgs as parseCliArgs } from "@std/cli/parse-args";
export { version } from "../../version.ts";

export type CliCommand =
  | "start"
  | "update"
  | "document-add"
  | "document-inspect"
  | "document-list"
  | "comment-add"
  | "comment-delete"
  | "comment-list"
  | "comment-reopen"
  | "comment-reply-add"
  | "comment-reply-delete"
  | "comment-reply-update"
  | "comment-resolve"
  | "comment-update";

export type CliOptions = {
  asBot: boolean;
  body?: string;
  channel?: "stable" | "nightly";
  command?: CliCommand;
  commentId?: number;
  commentIds?: number[];
  documentId?: number;
  endLine?: number;
  ensureDocument: boolean;
  file?: string;
  host: string;
  keepAlive: boolean;
  open: boolean;
  port: number;
  replyId?: number;
  requestReview: boolean;
  source?: string;
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
  sadoku start <file.md|directory|url> [--port <port>] [--host <host>] [--no-open] [--keep-alive]
  sadoku document add <file.md|url>
  sadoku document inspect <document-id>
  sadoku document list
  sadoku comment list (--document <id> | --source <file.md|url>)
  sadoku comment add (--document <id> | --source <file.md|url> [--ensure-document]) --start-line <line> [--end-line <line>] --body <text> [--as-bot]
  sadoku comment update <comment-id> (--document <id> | --source <file.md|url>) --body <text>
  sadoku comment delete <comment-id> (--document <id> | --source <file.md|url>)
  sadoku comment resolve <comment-id>... (--document <id> | --source <file.md|url>) [--as-bot]
  sadoku comment reopen <comment-id>... (--document <id> | --source <file.md|url>)
  sadoku comment reply add (--document <id> | --source <file.md|url>) --comment <id> --body <text> [--as-bot] [--request-review]
  sadoku comment reply update <reply-id> (--document <id> | --source <file.md|url>) --comment <id> --body <text>
  sadoku comment reply delete <reply-id> (--document <id> | --source <file.md|url>) --comment <id>
  sadoku update [--channel stable|nightly]

Options:
  --document        Existing document ID.
  --source          Existing Markdown file or URL.
  --ensure-document Register --source when it is not in the database (comment add only).
  --comment         Parent comment ID for reply operations.
  --start-line      First commented line.
  --end-line        Last commented line. Defaults to --start-line.
  --body            Comment or reply body.
  --as-bot          Attribute supported comment actions to a bot.
  --request-review  Request review in a bot reply (requires --as-bot).
  -p, --port        Starting preview port. Defaults to 3334.
  --host            Preview host. Defaults to 127.0.0.1.
  --no-open         Do not open the preview automatically.
  --keep-alive      Keep the server running after the browser tab closes.
  --channel         Update channel.
  -v, --version     Show version.
  -h, --help        Show this help message.
`;

const positiveInteger = (value: unknown, name: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CliUsageError(`${name} must be a positive integer.`);
  }
  return parsed;
};

export const parseArgs = (argv: string[]): CliOptions => {
  let flags: ReturnType<typeof parseCliArgs>;
  try {
    flags = parseCliArgs(argv, {
      alias: { h: "help", p: "port", v: "version" },
      boolean: [
        "as-bot",
        "ensure-document",
        "help",
        "keep-alive",
        "no-open",
        "request-review",
        "version",
      ],
      default: { host: "127.0.0.1", port: "3334" },
      string: [
        "body",
        "channel",
        "comment",
        "document",
        "end-line",
        "host",
        "port",
        "source",
        "start-line",
      ],
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

  const words = flags._.map(String);
  const base: CliOptions = {
    asBot: Boolean(flags["as-bot"]),
    ensureDocument: Boolean(flags["ensure-document"]),
    host: flags.host?.toString() ?? "127.0.0.1",
    keepAlive: Boolean(flags["keep-alive"]),
    open: !flags["no-open"],
    port: positiveInteger(flags.port, "Port"),
    requestReview: Boolean(flags["request-review"]),
  };
  if (base.port > 65535) throw new CliUsageError(`Invalid port: ${base.port}`);
  if (flags.help) base.help = true;
  if (flags.version) base.version = true;

  const hasCommentOption = flags.body !== undefined ||
    flags.comment !== undefined || flags.document !== undefined ||
    flags["end-line"] !== undefined || flags.source !== undefined ||
    flags["start-line"] !== undefined || flags["as-bot"] ||
    flags["ensure-document"] || flags["request-review"];

  if (words[0] === "start" || words.length === 0) {
    if (hasCommentOption || flags.channel !== undefined) {
      throw new CliUsageError(
        "Preview commands do not accept document, comment, or update options.",
      );
    }
    if (words.length > 2) {
      throw new CliUsageError("Only one preview source is accepted.");
    }
    return {
      ...base,
      command: words[0] === "start" ? "start" : undefined,
      file: words[1],
    };
  }
  if (words[0] === "update") {
    if (words.length !== 1) {
      throw new CliUsageError("update does not accept positional arguments.");
    }
    if (
      hasCommentOption || base.host !== "127.0.0.1" || base.port !== 3334 ||
      !base.open || base.keepAlive
    ) {
      throw new CliUsageError(
        "update does not accept preview, document, or comment options.",
      );
    }
    const channel = flags.channel?.toString();
    if (
      channel !== undefined && channel !== "stable" && channel !== "nightly"
    ) {
      throw new CliUsageError(`Invalid update channel: ${channel}.`);
    }
    return { ...base, command: "update", ...(channel ? { channel } : {}) };
  }

  const noPreviewOptions = () => {
    if (
      base.host !== "127.0.0.1" || base.port !== 3334 || !base.open ||
      base.keepAlive
    ) {
      throw new CliUsageError("This command does not accept preview options.");
    }
  };
  noPreviewOptions();

  if (words[0] === "document") {
    if (hasCommentOption || flags.channel !== undefined) {
      throw new CliUsageError(
        "document commands do not accept comment or update options.",
      );
    }
    if (words[1] === "list" && words.length === 2) {
      return { ...base, command: "document-list" };
    }
    if (words[1] === "add" && words.length === 3) {
      return { ...base, command: "document-add", source: words[2] };
    }
    if (words[1] === "inspect" && words.length === 3) {
      return {
        ...base,
        command: "document-inspect",
        documentId: positiveInteger(words[2], "Document ID"),
      };
    }
    throw new CliUsageError("Invalid document command.");
  }

  if (words[0] !== "comment") {
    throw new CliUsageError(`Invalid command: ${words[0]}`);
  }
  if (flags.channel !== undefined) {
    throw new CliUsageError("--channel is only accepted by update.");
  }
  const documentId = flags.document === undefined
    ? undefined
    : positiveInteger(flags.document, "Document ID");
  const source = flags.source?.toString();
  if ((documentId === undefined) === (source === undefined)) {
    throw new CliUsageError("Specify exactly one of --document or --source.");
  }
  const target = { documentId, source };
  const body = flags.body?.toString();
  const parentCommentId = flags.comment === undefined
    ? undefined
    : positiveInteger(flags.comment, "Comment ID");

  if (base.ensureDocument && words[1] !== "add") {
    throw new CliUsageError(
      "--ensure-document is only accepted by comment add.",
    );
  }

  if (words[1] === "list" && words.length === 2) {
    return { ...base, ...target, command: "comment-list" };
  }
  if (words[1] === "add" && words.length === 2) {
    if (!body) throw new CliUsageError("--body is required.");
    if (flags["start-line"] === undefined) {
      throw new CliUsageError("--start-line is required.");
    }
    const startLine = positiveInteger(
      flags["start-line"],
      "Comment start line",
    );
    const endLine = flags["end-line"] === undefined
      ? startLine
      : positiveInteger(flags["end-line"], "Comment end line");
    if (endLine < startLine) {
      throw new CliUsageError(
        "Comment end line must not precede the start line.",
      );
    }
    if (base.ensureDocument && !source) {
      throw new CliUsageError("--ensure-document requires --source.");
    }
    return {
      ...base,
      ...target,
      body,
      command: "comment-add",
      endLine,
      startLine,
    };
  }
  if (words[1] === "reply") {
    if (parentCommentId === undefined) {
      throw new CliUsageError("--comment is required.");
    }
    if (words[2] === "add" && words.length === 3) {
      if (!body) throw new CliUsageError("--body is required.");
      if (base.requestReview && !base.asBot) {
        throw new CliUsageError("--request-review requires --as-bot.");
      }
      return {
        ...base,
        ...target,
        body,
        command: "comment-reply-add",
        commentId: parentCommentId,
      };
    }
    if (
      (words[2] === "update" || words[2] === "delete") && words.length === 4
    ) {
      const replyId = positiveInteger(words[3], "Reply ID");
      if (words[2] === "update" && !body) {
        throw new CliUsageError("--body is required.");
      }
      return {
        ...base,
        ...target,
        body,
        command: `comment-reply-${words[2]}` as CliCommand,
        commentId: parentCommentId,
        replyId,
      };
    }
    throw new CliUsageError("Invalid comment reply command.");
  }

  if (words[1] === "update" || words[1] === "delete") {
    if (words.length !== 3) {
      throw new CliUsageError(`comment ${words[1]} requires one comment ID.`);
    }
    if (words[1] === "update" && !body) {
      throw new CliUsageError("--body is required.");
    }
    return {
      ...base,
      ...target,
      body,
      command: `comment-${words[1]}` as CliCommand,
      commentId: positiveInteger(words[2], "Comment ID"),
    };
  }
  if (words[1] === "resolve" || words[1] === "reopen") {
    if (words.length < 3) {
      throw new CliUsageError(
        `comment ${words[1]} requires at least one comment ID.`,
      );
    }
    return {
      ...base,
      ...target,
      command: `comment-${words[1]}` as CliCommand,
      commentIds: words.slice(2).map((id) => positiveInteger(id, "Comment ID")),
    };
  }
  throw new CliUsageError("Invalid comment command.");
};
