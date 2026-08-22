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
});
