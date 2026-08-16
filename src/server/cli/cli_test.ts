import { assertEquals, assertStringIncludes } from "@std/assert";

import { type CliDependencies, type CliIo, runCli } from "./cli.ts";

const dependencies: CliDependencies = {
  startPreviewServer: () =>
    Promise.reject(new Error("The test must not start the preview server.")),
};

const captureIo = (): {
  errors: string[];
  io: CliIo;
  logs: string[];
} => {
  const errors: string[] = [];
  const logs: string[] = [];
  return {
    errors,
    io: {
      confirm: () => false,
      error: (message) => errors.push(message),
      log: (message) => logs.push(message),
      prompt: () => null,
    },
    logs,
  };
};

Deno.test("runs the help command through the server CLI entry point", async () => {
  const output = captureIo();

  assertEquals(await runCli(["--help"], dependencies, output.io), 0);
  assertEquals(output.errors, []);
  assertStringIncludes(output.logs.join("\n"), "Usage:");
});

Deno.test("reports usage errors through the server CLI entry point", async () => {
  const output = captureIo();

  assertEquals(await runCli(["--unknown"], dependencies, output.io), 1);
  assertStringIncludes(output.errors[0], "Unknown option: --unknown");
  assertStringIncludes(output.errors[1], "Usage:");
});

Deno.test("requests preview startup through an injected dependency", async () => {
  const output = captureIo();
  const startupOptions: unknown[] = [];

  const exitCode = await runCli(
    ["start", "README.md", "--no-open"],
    {
      startPreviewServer: (options) => {
        startupOptions.push(options);
        return Promise.resolve({
          filePath: "/workspace/sadoku/README.md",
          url: "http://127.0.0.1:3334/",
        });
      },
    },
    output.io,
  );

  assertEquals(exitCode, 0);
  assertEquals(startupOptions, [{
    file: "README.md",
    host: "127.0.0.1",
    keepAlive: false,
    port: 3334,
  }]);
});

Deno.test("rejects directories for explicitly classified comment commands", async () => {
  const output = captureIo();
  const directory = await Deno.makeTempDir({ prefix: "sadoku-cli-" });
  try {
    assertEquals(
      await runCli(["comments", "inspect", directory], dependencies, output.io),
      1,
    );
    assertStringIncludes(
      output.errors[0],
      "Comment commands require a Markdown file or URL.",
    );
  } finally {
    await Deno.remove(directory);
  }
});
