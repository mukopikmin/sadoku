import { assertEquals, assertStringIncludes } from "@std/assert";

import { type CliDependencies, type CliIo, runCli } from "./cli.ts";
import { withTempCommentsDirectory } from "../test_helpers.ts";
import { join } from "@std/path";

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

Deno.test("document add creates and registers files only with --create", async () => {
  await withTempCommentsDirectory(async () => {
    const root = await Deno.makeTempDir();
    try {
      await Deno.mkdir(join(root, "docs"));
      const source = join(root, "docs", "notes");
      const output = captureIo();
      assertEquals(
        await runCli(
          ["document", "add", source, "--create", "--title", "メモ"],
          dependencies,
          output.io,
        ),
        0,
      );
      assertEquals(output.errors, []);
      assertEquals(await Deno.readTextFile(`${source}.md`), "# メモ\n");
      const document = JSON.parse(output.logs[0]);
      assertEquals(document.filePath, `${source}.md`);
      const listed = captureIo();
      assertEquals(
        await runCli(["document", "list"], dependencies, listed.io),
        0,
      );
      assertEquals(JSON.parse(listed.logs[0]), [document]);

      const duplicate = captureIo();
      assertEquals(
        await runCli(
          ["document", "add", source, "--create", "--title", "Changed"],
          dependencies,
          duplicate.io,
        ),
        1,
      );
      assertStringIncludes(duplicate.errors[0], "already exists");
      assertEquals(await Deno.readTextFile(`${source}.md`), "# メモ\n");
      assertEquals(
        await runCli(
          ["document", "add", `${source}.md`],
          dependencies,
          captureIo().io,
        ),
        0,
      );

      const empty = join(root, "empty.markdown");
      assertEquals(
        await runCli(
          ["document", "add", empty, "--create"],
          dependencies,
          captureIo().io,
        ),
        0,
      );
      assertEquals(await Deno.readTextFile(empty), "");

      for (
        const path of [
          "https://example.com/notes.md",
          join(root, "bad.txt"),
          join(root, "missing", "notes.md"),
        ]
      ) {
        const failure = captureIo();
        assertEquals(
          await runCli(
            ["document", "add", path, "--create"],
            dependencies,
            failure.io,
          ),
          1,
        );
        assertEquals(failure.logs, []);
      }
      const finalList = captureIo();
      await runCli(["document", "list"], dependencies, finalList.io);
      assertEquals(JSON.parse(finalList.logs[0]).length, 2);
      assertEquals(
        (await Array.fromAsync(Deno.readDir(join(root, "docs")))).map((
          { name },
        ) => name),
        ["notes.md"],
      );
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  });
});

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

Deno.test("passes directory scan limits to preview startup", async () => {
  const output = captureIo();
  let startupOptions: unknown;

  const exitCode = await runCli(
    ["start", "docs", "--max-depth", "4", "--max-files", "50", "--no-open"],
    {
      startPreviewServer: (options) => {
        startupOptions = options;
        return Promise.resolve({
          filePath: "/workspace/sadoku/docs",
          url: "http://127.0.0.1:3334/",
        });
      },
    },
    output.io,
  );

  assertEquals(exitCode, 0);
  assertEquals(startupOptions, {
    file: "docs",
    host: "127.0.0.1",
    keepAlive: false,
    maxDepth: 4,
    maxFiles: 50,
    port: 3334,
  });
});

Deno.test("registers a source on demand before adding a comment", async () => {
  await withTempCommentsDirectory(async () => {
    const file = await Deno.makeTempFile({ suffix: ".md" });
    await Deno.writeTextFile(file, "# Heading\n");
    try {
      const output = captureIo();
      assertEquals(
        await runCli(
          [
            "comment",
            "add",
            "--source",
            file,
            "--ensure-document",
            "--start-line",
            "1",
            "--body",
            "Check the heading.",
          ],
          dependencies,
          output.io,
        ),
        0,
      );
      assertEquals(JSON.parse(output.logs[0]).body, "Check the heading.");

      const documents = captureIo();
      assertEquals(
        await runCli(["document", "list"], dependencies, documents.io),
        0,
      );
      assertEquals(JSON.parse(documents.logs[0]), [{ filePath: file, id: 1 }]);
    } finally {
      await Deno.remove(file);
    }
  });
});

Deno.test("dispatches memory CRUD commands", async () => {
  await withTempCommentsDirectory(async () => {
    await runCli(
      ["document", "add", "README.md"],
      dependencies,
      captureIo().io,
    );
    const added = captureIo();
    assertEquals(
      await runCli(
        ["memory", "add", "--document", "1", "--content", "Stable fact.\r\n"],
        dependencies,
        added.io,
      ),
      0,
    );
    assertEquals(JSON.parse(added.logs[0]).content, "Stable fact.");
    const updated = captureIo();
    await runCli(
      [
        "memory",
        "update",
        "1",
        "--document",
        "1",
        "--content",
        "Updated fact.",
      ],
      dependencies,
      updated.io,
    );
    assertEquals(JSON.parse(updated.logs[0]).content, "Updated fact.");
    const listed = captureIo();
    await runCli(
      ["memory", "list", "--document", "1"],
      dependencies,
      listed.io,
    );
    assertEquals(
      JSON.parse(listed.logs[0]).memories[0].content,
      "Updated fact.",
    );
    const deleted = captureIo();
    await runCli(
      ["memory", "delete", "1", "--document", "1"],
      dependencies,
      deleted.io,
    );
    assertEquals(deleted.logs, ["Deleted memory 1."]);
  });
});

Deno.test("dispatches instruction commands with canonical sources and JSON output", async () => {
  await withTempCommentsDirectory(async () => {
    const registered = captureIo();
    assertEquals(
      await runCli(
        ["document", "add", "https://example.com/guide.md?token=secret#part"],
        dependencies,
        registered.io,
      ),
      0,
    );
    assertEquals(JSON.parse(registered.logs[0]), {
      filePath: "https://example.com/guide.md",
      id: 1,
    });

    const added = captureIo();
    assertEquals(
      await runCli(
        [
          "instruction",
          "add",
          "--source",
          "https://example.com/guide.md?different=value#other",
          "--content",
          "Review links.\r\n",
        ],
        dependencies,
        added.io,
      ),
      0,
    );
    assertEquals(JSON.parse(added.logs[0]).content, "Review links.");

    const updated = captureIo();
    assertEquals(
      await runCli(
        [
          "instruction",
          "update",
          "1",
          "--document",
          "1",
          "--content",
          "Review every link.",
        ],
        dependencies,
        updated.io,
      ),
      0,
    );
    assertEquals(JSON.parse(updated.logs[0]).content, "Review every link.");

    const listed = captureIo();
    assertEquals(
      await runCli(
        ["instruction", "list", "--source", "https://example.com/guide.md?q=1"],
        dependencies,
        listed.io,
      ),
      0,
    );
    const result = JSON.parse(listed.logs[0]);
    assertEquals(result.document.filePath, "https://example.com/guide.md");
    assertEquals(result.instructions[0].content, "Review every link.");

    const deleted = captureIo();
    assertEquals(
      await runCli(
        ["instruction", "delete", "1", "--document", "1"],
        dependencies,
        deleted.io,
      ),
      0,
    );
    assertEquals(deleted.logs, ["Deleted instruction 1."]);

    // A final command succeeding confirms each prior command closed its store.
    const documents = captureIo();
    assertEquals(
      await runCli(["document", "list"], dependencies, documents.io),
      0,
    );
  });
});

Deno.test("does not register an unknown instruction source implicitly", async () => {
  await withTempCommentsDirectory(async () => {
    const output = captureIo();
    assertEquals(
      await runCli(
        [
          "instruction",
          "list",
          "--source",
          "https://example.com/missing.md?token=x",
        ],
        dependencies,
        output.io,
      ),
      1,
    );
    assertStringIncludes(
      output.errors[0],
      "Document is not registered: https://example.com/missing.md",
    );
    assertStringIncludes(output.errors[0], "sadoku document add");

    const documents = captureIo();
    await runCli(["document", "list"], dependencies, documents.io);
    assertEquals(JSON.parse(documents.logs[0]), []);
  });
});

Deno.test("passes explicit proxy trust to preview startup", async () => {
  const output = captureIo();
  let trustForwardedPrefix: boolean | undefined;
  const result = await runCli([
    "start",
    "README.md",
    "--no-open",
    "--trust-forwarded-prefix",
  ], {
    startPreviewServer: (options) => {
      trustForwardedPrefix = options.trustForwardedPrefix;
      return Promise.resolve({
        filePath: "README.md",
        url: "http://127.0.0.1:3334/",
      });
    },
  }, output.io);
  assertEquals(result, 0);
  assertEquals(trustForwardedPrefix, true);
});
