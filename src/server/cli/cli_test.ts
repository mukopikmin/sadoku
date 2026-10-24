import { assertEquals, assertStringIncludes } from "@std/assert";

import { type CliDependencies, type CliIo, runCli } from "./cli.ts";
import { withTempCommentsDirectory } from "../testing/helpers.ts";

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

const runJsonCommand = async (args: string[]) => {
  const output = captureIo();
  assertEquals(
    await runCli(args, dependencies, output.io),
    0,
    output.errors.join("\n"),
  );
  assertEquals(output.errors, []);
  return JSON.parse(output.logs[0]);
};

Deno.test("document tag commands persist additions and removals and expose tags through document reads", async () => {
  await withTempCommentsDirectory(async () => {
    const document = await runJsonCommand([
      "document",
      "add",
      "https://example.com/readme.md?token=secret#top",
    ]);
    const other = await runJsonCommand(["document", "add", "README.md"]);
    const api = await runJsonCommand(["tag", "add", "--name", "API"]);
    const review = await runJsonCommand(["tag", "add", "--name", "Review"]);
    const tags = [api, review].map(({ id, name, backgroundColor }) => ({
      id,
      name,
      backgroundColor,
    }));
    assertEquals(
      await runJsonCommand(["document", "inspect", String(document.id)]),
      { ...document, tags: [] },
    );
    assertEquals(
      await runJsonCommand([
        "document",
        "tag",
        "add",
        String(api.id),
        String(review.id),
        String(api.id),
        "--source",
        "https://example.com/readme.md?different=value#other",
      ]),
      tags,
    );
    assertEquals(
      await runJsonCommand([
        "document",
        "tag",
        "add",
        String(api.id),
        "--document",
        String(document.id),
      ]),
      tags,
    );
    assertEquals(
      await runJsonCommand([
        "document",
        "tag",
        "add",
        String(api.id),
        "--document",
        String(other.id),
      ]),
      [tags[0]],
    );
    assertEquals(await runJsonCommand(["document", "list"]), [
      { ...document, tags },
      { ...other, tags: [tags[0]] },
    ]);
    assertEquals(
      await runJsonCommand(["document", "inspect", String(document.id)]),
      { ...document, tags },
    );
    assertEquals(
      await runJsonCommand([
        "document",
        "tag",
        "delete",
        String(api.id),
        "--document",
        String(document.id),
      ]),
      [tags[1]],
    );
    assertEquals(
      await runJsonCommand([
        "document",
        "tag",
        "delete",
        String(api.id),
        "--document",
        String(document.id),
      ]),
      [tags[1]],
    );
    assertEquals(
      await runJsonCommand([
        "document",
        "tag",
        "delete",
        String(review.id),
        "--source",
        "https://example.com/readme.md",
      ]),
      [],
    );
    assertEquals(
      await runJsonCommand(["document", "inspect", String(document.id)]),
      { ...document, tags: [] },
    );
    assertEquals(
      await runJsonCommand(["document", "inspect", String(other.id)]),
      { ...other, tags: [tags[0]] },
    );
    const allTags: Array<{ id: number; documentCount: number }> =
      await runJsonCommand(["tag", "list"]);
    assertEquals(
      allTags.map(({ id, documentCount }) => ({ id, documentCount })),
      [
        { id: api.id, documentCount: 1 },
        { id: review.id, documentCount: 0 },
      ],
    );
  });
});

Deno.test("document tag commands reject missing documents and tags without partial changes or implicit creation", async () => {
  await withTempCommentsDirectory(async () => {
    const document = await runJsonCommand(["document", "add", "README.md"]);
    const tag = await runJsonCommand(["tag", "add", "--name", "API"]);
    const target = ["--document", String(document.id)];
    for (const operation of ["add", "delete"]) {
      const output = captureIo();
      assertEquals(
        await runCli(
          ["document", "tag", operation, String(tag.id), "999", ...target],
          dependencies,
          output.io,
        ),
        1,
      );
      assertEquals(output.errors, ["Tag 999 not found."]);
      assertEquals(output.logs, []);
      assertEquals(
        (await runJsonCommand(["document", "inspect", String(document.id)]))
          .tags,
        [],
      );
    }
    await runJsonCommand(["document", "tag", "add", String(tag.id), ...target]);
    const failedDelete = captureIo();
    assertEquals(
      await runCli(
        ["document", "tag", "delete", String(tag.id), "999", ...target],
        dependencies,
        failedDelete.io,
      ),
      1,
    );
    assertEquals(
      (await runJsonCommand(["document", "inspect", String(document.id)])).tags
        .map(({ id }: { id: number }) => id),
      [tag.id],
    );
    for (
      const selector of [["--document", "999"], [
        "--source",
        "https://example.com/missing.md?token=secret#part",
      ]]
    ) {
      const output = captureIo();
      assertEquals(
        await runCli(
          ["document", "tag", "add", String(tag.id), ...selector],
          dependencies,
          output.io,
        ),
        1,
      );
      assertEquals(output.logs, []);
      assertEquals(output.errors.length, 1);
      assertEquals(output.errors[0].includes("token="), false);
    }
    assertEquals((await runJsonCommand(["document", "list"])).length, 1);
    assertEquals((await runJsonCommand(["tag", "list"])).length, 1);
  });
});

Deno.test("runs the help command through the server CLI entry point", async () => {
  const output = captureIo();

  assertEquals(await runCli(["--help"], dependencies, output.io), 0);
  assertEquals(output.errors, []);
  assertStringIncludes(output.logs.join("\n"), "Usage:");
});

Deno.test("dispatches standalone tag creation, listing, and deletion without starting a server", async () => {
  await withTempCommentsDirectory(async () => {
    const empty = captureIo();
    assertEquals(await runCli(["tag", "list"], dependencies, empty.io), 0);
    assertEquals(JSON.parse(empty.logs[0]), []);

    const added = captureIo();
    assertEquals(
      await runCli(
        [
          "tag",
          "add",
          "--name",
          " 要確認 ",
        ],
        dependencies,
        added.io,
      ),
      0,
    );
    const tag = JSON.parse(added.logs[0]);
    assertEquals(tag.name, "要確認");
    assertEquals(tag.backgroundColor, "#718096");
    assertEquals(typeof tag.id, "number");
    assertEquals(typeof tag.createdAt, "string");
    assertEquals(tag.updatedAt, tag.createdAt);
    assertEquals(added.errors, []);

    const defaultColor = captureIo();
    assertEquals(
      await runCli(
        ["tag", "add", "--name", "API"],
        dependencies,
        defaultColor.io,
      ),
      0,
    );
    const api = JSON.parse(defaultColor.logs[0]);
    assertEquals(api.backgroundColor, "#718096");

    const duplicate = captureIo();
    assertEquals(
      await runCli(
        ["tag", "add", "--name", " 要確認 "],
        dependencies,
        duplicate.io,
      ),
      1,
    );
    assertEquals(duplicate.errors, ["Tag name already exists."]);
    assertEquals(duplicate.logs, []);

    const listed = captureIo();
    assertEquals(await runCli(["tag", "list"], dependencies, listed.io), 0);
    assertEquals(JSON.parse(listed.logs[0]), [
      { ...api, documentCount: 0 },
      { ...tag, documentCount: 0 },
    ]);
    const documents = captureIo();
    assertEquals(
      await runCli(["document", "list"], dependencies, documents.io),
      0,
    );
    assertEquals(JSON.parse(documents.logs[0]), []);

    const deleted = captureIo();
    assertEquals(
      await runCli(["tag", "delete", String(tag.id)], dependencies, deleted.io),
      0,
    );
    assertEquals(deleted.logs, [`Deleted tag ${tag.id}.`]);
    const missing = captureIo();
    assertEquals(
      await runCli(["tag", "delete", String(tag.id)], dependencies, missing.io),
      1,
    );
    assertEquals(missing.errors, [`Tag ${tag.id} not found.`]);
    assertEquals(missing.logs, []);
    const remaining = captureIo();
    assertEquals(await runCli(["tag", "list"], dependencies, remaining.io), 0);
    assertEquals(JSON.parse(remaining.logs[0]), [{ ...api, documentCount: 0 }]);
  });
});

Deno.test("rejects invalid tag names and color options without creating tags", async () => {
  await withTempCommentsDirectory(async () => {
    for (
      const options of [
        ["--name", " "],
        ["--name", "a\nb"],
        ["--name", "a".repeat(51)],
      ]
    ) {
      const output = captureIo();
      assertEquals(
        await runCli(["tag", "add", ...options], dependencies, output.io),
        1,
      );
      assertEquals(output.logs, []);
      assertEquals(output.errors.length, 1);
      assertStringIncludes(output.errors[0], "Tag ");
    }
    const colorOption = captureIo();
    assertEquals(
      await runCli(
        ["tag", "add", "--name", "API", "--background-color", "#123456"],
        dependencies,
        colorOption.io,
      ),
      1,
    );
    assertEquals(colorOption.logs, []);
    assertEquals(colorOption.errors[0], "Unknown option: --background-color");
    const listed = captureIo();
    assertEquals(await runCli(["tag", "list"], dependencies, listed.io), 0);
    assertEquals(JSON.parse(listed.logs[0]), []);
  });
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
      assertEquals(JSON.parse(documents.logs[0]), [{
        filePath: file,
        id: 1,
        tags: [],
      }]);
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
