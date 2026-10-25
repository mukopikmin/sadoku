import { assertEquals, assertMatch, assertThrows } from "@std/assert";
import { CliUsageError, parseArgs, usage } from "./args.ts";

Deno.test("parses preview and document commands", () => {
  assertEquals(parseArgs(["start", "README.md", "--no-open"]), {
    asBot: false,
    command: "start",
    ensureDocument: false,
    file: "README.md",
    host: "127.0.0.1",
    keepAlive: false,
    open: false,
    port: 3334,
    requestReview: false,
  });
  assertEquals(
    parseArgs(["document", "inspect", "3"]).command,
    "document-inspect",
  );
  assertEquals(parseArgs(["document", "add", "README.md"]).source, "README.md");
  assertEquals(parseArgs(["document", "list"]).command, "document-list");
});

Deno.test("parses and validates directory scan limits", () => {
  const options = parseArgs([
    "start",
    "docs",
    "--max-depth",
    "0",
    "--max-files",
    "100",
  ]);
  assertEquals(options.maxDepth, 0);
  assertEquals(options.maxFiles, 100);

  for (
    const args of [
      ["start", "docs", "--max-depth", "-1"],
      ["start", "docs", "--max-depth", "1.5"],
      ["start", "docs", "--max-files", "0"],
      ["start", "docs", "--max-files", "many"],
      ["comment", "list", "--document", "1", "--max-files", "10"],
      ["update", "--max-depth", "1"],
    ]
  ) {
    assertThrows(() => parseArgs(args), CliUsageError);
  }
});

Deno.test("parses named comment creation input and defaults the end line", () => {
  const options = parseArgs([
    "comment",
    "add",
    "--source",
    "README.md",
    "--ensure-document",
    "--start-line",
    "10",
    "--body",
    "Check this line.",
  ]);
  assertEquals(options.command, "comment-add");
  assertEquals(options.source, "README.md");
  assertEquals(options.ensureDocument, true);
  assertEquals(options.startLine, 10);
  assertEquals(options.endLine, 10);
  assertEquals(options.body, "Check this line.");
});

Deno.test("parses comment and nested reply operations", () => {
  assertEquals(
    parseArgs(["comment", "resolve", "4", "5", "--document", "1"])
      .commentIds,
    [4, 5],
  );
  const reply = parseArgs([
    "comment",
    "reply",
    "update",
    "7",
    "--document",
    "1",
    "--comment",
    "4",
    "--body",
    "Updated.",
  ]);
  assertEquals(reply.command, "comment-reply-update");
  assertEquals(reply.documentId, 1);
  assertEquals(reply.commentId, 4);
  assertEquals(reply.replyId, 7);
});

Deno.test("requires exactly one document selector", () => {
  assertThrows(
    () => parseArgs(["comment", "list"]),
    CliUsageError,
    "Specify exactly one",
  );
  assertThrows(
    () =>
      parseArgs([
        "comment",
        "list",
        "--document",
        "1",
        "--source",
        "README.md",
      ]),
    CliUsageError,
    "Specify exactly one",
  );
});

Deno.test("restricts document creation to source-based comment add", () => {
  assertThrows(
    () =>
      parseArgs([
        "comment",
        "add",
        "--document",
        "1",
        "--ensure-document",
        "--start-line",
        "1",
        "--body",
        "Body",
      ]),
    CliUsageError,
    "requires --source",
  );
  assertThrows(
    () =>
      parseArgs([
        "comment",
        "list",
        "--source",
        "README.md",
        "--ensure-document",
      ]),
    CliUsageError,
    "only accepted by comment add",
  );
});

Deno.test("validates reply review requests and numeric identifiers", () => {
  assertThrows(
    () =>
      parseArgs([
        "comment",
        "reply",
        "add",
        "--document",
        "1",
        "--comment",
        "2",
        "--body",
        "Review.",
        "--request-review",
      ]),
    CliUsageError,
    "requires --as-bot",
  );
  assertThrows(
    () => parseArgs(["document", "inspect", "zero"]),
    CliUsageError,
    "positive integer",
  );
});

Deno.test("usage documents singular resource commands", () => {
  assertMatch(usage, /document add/);
  assertMatch(usage, /document tag add <tag-id>\.\.\./);
  assertMatch(usage, /document tag delete <tag-id>\.\.\./);
  assertMatch(usage, /comment delete/);
  assertMatch(usage, /comment reply update/);
  assertMatch(usage, /--ensure-document/);
  assertMatch(usage, /instruction list \(--document <id> \| --source/);
  assertMatch(usage, /instruction add .*--content <text>/);
  assertMatch(usage, /instruction update <instruction-id>/);
  assertMatch(usage, /instruction delete <instruction-id>/);
  assertMatch(usage, /memory add .*--content <text>/);
  assertMatch(usage, /memory update <memory-id>/);
  assertMatch(usage, /tag add --name <name>/);
  assertMatch(usage, /tag delete <tag-id>/);
  assertMatch(usage, /tag list/);
});

Deno.test("parses standalone tag commands", () => {
  const added = parseArgs([
    "tag",
    "add",
    "--name",
    "要確認",
  ]);
  assertEquals(added.command, "tag-add");
  assertEquals(added.tagName, "要確認");
  assertEquals(parseArgs(["tag", "list"]).command, "tag-list");
  const deleted = parseArgs(["tag", "delete", "3"]);
  assertEquals(deleted.command, "tag-delete");
  assertEquals(deleted.tagId, 3);
});

Deno.test("parses document tag additions and deletions with either document selector", () => {
  const added = parseArgs([
    "document",
    "tag",
    "add",
    "3",
    "5",
    "--document",
    "2",
  ]);
  assertEquals(added.command, "document-tag-add");
  assertEquals(added.tagIds, [3, 5]);
  assertEquals(added.documentId, 2);
  const deleted = parseArgs([
    "document",
    "tag",
    "delete",
    "3",
    "5",
    "--source",
    "README.md",
  ]);
  assertEquals(deleted.command, "document-tag-delete");
  assertEquals(deleted.tagIds, [3, 5]);
  assertEquals(deleted.source, "README.md");
});

Deno.test("rejects invalid document tag commands and incompatible options", () => {
  for (
    const args of [
      ["document", "tag"],
      ["document", "tag", "add", "--document", "1"],
      ["document", "tag", "delete", "--source", "README.md"],
      ["document", "tag", "add", "3"],
      [
        "document",
        "tag",
        "add",
        "3",
        "--document",
        "1",
        "--source",
        "README.md",
      ],
      ...["list", "set", "clear", "update", "remove"].map((
        operation,
      ) => ["document", "tag", operation, "3", "--document", "1"]),
      ...["0", "-1", "1.5", "NaN", "Infinity", "nope", "9007199254740992"]
        .flatMap((id) => [
          ["document", "tag", "add", id, "--document", "1"],
          ["document", "tag", "delete", "3", "--document", id],
        ]),
      ...[
        ["--body", "x"],
        ["--comment", "1"],
        ["--start-line", "1"],
        ["--end-line", "1"],
        ["--as-bot"],
        ["--ensure-document"],
        ["--request-review"],
        ["--content", "x"],
        ["--channel", "stable"],
        ["--name", "API"],
        ["--background-color", "#123456"],
        ["--port", "4000"],
        ["--host", "0.0.0.0"],
        ["--no-open"],
        ["--keep-alive"],
        ["--max-depth", "1"],
        ["--max-files", "1"],
        ["--trust-forwarded-prefix"],
      ].map((
        option,
      ) => ["document", "tag", "add", "3", "--document", "1", ...option]),
    ]
  ) {
    assertThrows(
      () => parseArgs(args),
      CliUsageError,
      undefined,
      args.join(" "),
    );
  }
});

Deno.test("rejects tag color options", () => {
  for (
    const command of [["tag", "add", "--name", "API"], ["tag", "list"], [
      "tag",
      "delete",
      "1",
    ]]
  ) {
    assertThrows(
      () => parseArgs([...command, "--background-color", "#123456"]),
      CliUsageError,
      "Unknown option: --background-color",
    );
  }
  assertEquals(usage.includes("--background-color"), false);
});

Deno.test("rejects invalid tag commands, IDs, and incompatible options", () => {
  for (
    const args of [
      ["tag"],
      ["tag", "add"],
      ["tag", "add", "API"],
      ["tag", "add", "--name", "API", "extra"],
      ["tag", "delete"],
      ["tag", "delete", "1", "2"],
      ["tag", "list", "1"],
      ["tag", "update", "1", "--name", "API"],
      ...["0", "-1", "1.5", "NaN", "Infinity", "nope", "9007199254740992"].map((
        id,
      ) => ["tag", "delete", id]),
      ...[
        ["--document", "1"],
        ["--source", "README.md"],
        ["--body", "x"],
        ["--content", "x"],
        ["--comment", "1"],
        ["--start-line", "1"],
        ["--end-line", "2"],
        ["--as-bot"],
        ["--ensure-document"],
        ["--request-review"],
        ["--port", "4000"],
        ["--host", "0.0.0.0"],
        ["--no-open"],
        ["--keep-alive"],
        ["--max-depth", "1"],
        ["--max-files", "1"],
        ["--trust-forwarded-prefix"],
        ["--channel", "stable"],
      ].map((option) => ["tag", "add", "--name", "API", ...option]),
      ["tag", "list", "--name", "API"],
      ["tag", "delete", "1", "--background-color", "#123456"],
      ["start", "README.md", "--name", "API"],
      ["update", "--background-color", "#123456"],
      ["document", "list", "--name", "API"],
      ["comment", "list", "--document", "1", "--name", "API"],
      [
        "instruction",
        "list",
        "--document",
        "1",
        "--background-color",
        "#123456",
      ],
      ["memory", "list", "--document", "1", "--name", "API"],
    ]
  ) {
    assertThrows(
      () => parseArgs(args),
      CliUsageError,
      undefined,
      args.join(" "),
    );
  }
});

Deno.test("parses and validates memory commands", () => {
  assertEquals(
    parseArgs(["memory", "list", "--document", "3"]).command,
    "memory-list",
  );
  assertEquals(
    parseArgs(["memory", "add", "--source", "README.md", "--content", "Fact."])
      .content,
    "Fact.",
  );
  const update = parseArgs([
    "memory",
    "update",
    "4",
    "--document",
    "3",
    "--content",
    "Updated.",
  ]);
  assertEquals(update.command, "memory-update");
  assertEquals(update.memoryId, 4);
  assertEquals(
    parseArgs(["memory", "delete", "4", "--source", "README.md"]).command,
    "memory-delete",
  );
  for (
    const args of [
      ["memory", "list"],
      ["memory", "list", "--document", "1", "--source", "README.md"],
      ["memory", "update", "0", "--document", "1", "--content", "x"],
      ["memory", "add", "--document", "1"],
      ["memory", "delete", "1", "--document", "1", "--content", "x"],
    ]
  ) assertThrows(() => parseArgs(args), CliUsageError);
});

Deno.test("parses every instruction command", () => {
  assertEquals(
    parseArgs(["instruction", "list", "--document", "3"]).command,
    "instruction-list",
  );
  assertEquals(
    parseArgs([
      "instruction",
      "add",
      "--source",
      "README.md",
      "--content",
      "Keep this concise.",
    ]).content,
    "Keep this concise.",
  );
  const update = parseArgs([
    "instruction",
    "update",
    "4",
    "--document",
    "3",
    "--content",
    "Updated.",
  ]);
  assertEquals(update.command, "instruction-update");
  assertEquals(update.instructionId, 4);
  assertEquals(
    parseArgs(["instruction", "delete", "4", "--source", "README.md"])
      .command,
    "instruction-delete",
  );
});

Deno.test("validates instruction selectors, IDs, and required content", () => {
  for (
    const args of [
      ["instruction", "list"],
      ["instruction", "list", "--document", "1", "--source", "README.md"],
      ["instruction", "update", "0", "--document", "1", "--content", "x"],
      ["instruction", "delete", "nope", "--document", "1"],
      ["instruction", "add", "--document", "1"],
      ["instruction", "update", "1", "--document", "1"],
    ]
  ) assertThrows(() => parseArgs(args), CliUsageError);
});

Deno.test("rejects forbidden options on instruction commands", () => {
  for (
    const option of [
      ["--ensure-document"],
      ["--body", "x"],
      ["--comment", "1"],
      ["--start-line", "1"],
      ["--as-bot"],
      ["--port", "4000"],
      ["--channel", "stable"],
    ]
  ) {
    assertThrows(
      () => parseArgs(["instruction", "list", "--document", "1", ...option]),
      CliUsageError,
    );
  }
  assertThrows(
    () =>
      parseArgs([
        "instruction",
        "delete",
        "1",
        "--document",
        "1",
        "--content",
        "x",
      ]),
    CliUsageError,
  );
});

Deno.test("requires explicit preview-only forwarded-prefix trust", () => {
  assertEquals(
    parseArgs(["start", "README.md"]).trustForwardedPrefix,
    undefined,
  );
  assertEquals(
    parseArgs(["start", "README.md", "--trust-forwarded-prefix"])
      .trustForwardedPrefix,
    true,
  );
  for (
    const command of [["update"], ["document", "list"], [
      "comment",
      "list",
      "--document",
      "1",
    ]]
  ) {
    assertThrows(
      () => parseArgs([...command, "--trust-forwarded-prefix"]),
      CliUsageError,
    );
  }
});

Deno.test("document add accepts a title and rejects titles on other commands", () => {
  assertEquals(
    parseArgs(["document", "add", "README.md", "--title", "Preview guide"])
      .title,
    "Preview guide",
  );
  assertEquals(
    parseArgs(["document", "add", "README.md", "--title="]).title,
    "",
  );
  for (
    const args of [
      ["document", "list", "--title", "Guide"],
      ["document", "inspect", "1", "--title", "Guide"],
      ["start", "README.md", "--title", "Guide"],
      ["document", "add", "README.md", "--title", "One\nTwo"],
      ["document", "add", "README.md", "--title", "One\rTwo"],
      ["document", "add", "README.md", "--title", "One\u0000Two"],
    ]
  ) {
    assertThrows(() => parseArgs(args), CliUsageError);
  }
});
