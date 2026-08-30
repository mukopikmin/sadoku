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
  assertMatch(usage, /comment delete/);
  assertMatch(usage, /comment reply update/);
  assertMatch(usage, /--ensure-document/);
  assertMatch(usage, /instruction list \(--document <id> \| --source/);
  assertMatch(usage, /instruction add .*--content <text>/);
  assertMatch(usage, /instruction update <instruction-id>/);
  assertMatch(usage, /instruction delete <instruction-id>/);
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
