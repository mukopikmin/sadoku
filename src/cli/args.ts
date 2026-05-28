export type CliOptions = {
  file: string | undefined;
  host: string;
  port: number;
  help?: boolean;
};

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export const usage = `Usage: mdview <file.md> [--port <port>] [--host <host>]

Options:
  -p, --port   Port to bind. Defaults to 3334.
  --host       Host to bind. Defaults to 127.0.0.1.
  -h, --help   Show this help message.
`;

export const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    file: undefined,
    host: "127.0.0.1",
    port: 3334,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }

    if (arg === "-p" || arg === "--port") {
      const value = argv[index + 1];
      if (!value) throw new CliUsageError(`${arg} requires a value.`);
      const port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new CliUsageError(`Invalid port: ${value}`);
      }
      options.port = port;
      index += 1;
      continue;
    }

    if (arg === "--host") {
      const value = argv[index + 1];
      if (!value) throw new CliUsageError("--host requires a value.");
      options.host = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new CliUsageError(`Unknown option: ${arg}`);
    }

    if (options.file) {
      throw new CliUsageError(
        "Only one Markdown file can be previewed at a time.",
      );
    }
    options.file = arg;
  }

  return options;
};
