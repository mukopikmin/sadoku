import {
  assertEquals,
  assertInstanceOf,
  assertMatch,
  assertThrows,
} from "@std/assert";
import { CliUsageError, parseArgs, usage, version } from "./args.ts";

Deno.test("uses the default host and port", () => {
  assertEquals(parseArgs(["start", "README.md"]), {
    asBot: false,
    command: "start",
    file: "README.md",
    force: false,
    host: "127.0.0.1",
    keepAlive: false,
    open: true,
    port: 3334,
  });
});

Deno.test("parses URL sources", () => {
  const source = "https://example.com/README.md?token=temporary";
  assertEquals(parseArgs(["start", source]), {
    asBot: false,
    command: "start",
    file: source,
    force: false,
    host: "127.0.0.1",
    keepAlive: false,
    open: true,
    port: 3334,
  });
});

Deno.test("parses host and port options", () => {
  assertEquals(
    parseArgs([
      "start",
      "README.md",
      "--host",
      "0.0.0.0",
      "--port",
      "4000",
    ]),
    {
      asBot: false,
      command: "start",
      file: "README.md",
      force: false,
      host: "0.0.0.0",
      keepAlive: false,
      open: true,
      port: 4000,
    },
  );
});

Deno.test("parses no-open option", () => {
  assertEquals(parseArgs(["start", "README.md", "--no-open"]), {
    asBot: false,
    command: "start",
    file: "README.md",
    force: false,
    host: "127.0.0.1",
    keepAlive: false,
    open: false,
    port: 3334,
  });
});

Deno.test("parses keep-alive option", () => {
  assertEquals(parseArgs(["start", "README.md", "--keep-alive"]), {
    asBot: false,
    command: "start",
    file: "README.md",
    force: false,
    host: "127.0.0.1",
    keepAlive: true,
    open: true,
    port: 3334,
  });
});

Deno.test("parses comments list command", () => {
  assertEquals(parseArgs(["comments", "list"]), {
    asBot: false,
    command: "comments-list",
    file: undefined,
    force: false,
    host: "127.0.0.1",
    keepAlive: false,
    open: true,
    port: 3334,
  });
});

Deno.test("parses comments inspect command", () => {
  assertEquals(parseArgs(["comments", "inspect", "README.md"]), {
    asBot: false,
    command: "comments-inspect",
    file: "README.md",
    force: false,
    host: "127.0.0.1",
    keepAlive: false,
    open: true,
    port: 3334,
  });
});

Deno.test("parses comments resolve command", () => {
  assertEquals(
    parseArgs(["comments", "resolve", "README.md", "1", "2"]),
    {
      asBot: false,
      command: "comments-resolve",
      commentIds: ["1", "2"],
      file: "README.md",
      force: false,
      host: "127.0.0.1",
      keepAlive: false,
      open: true,
      port: 3334,
    },
  );
  assertEquals(
    parseArgs([
      "comments",
      "resolve",
      "README.md",
      "1",
      "--as-bot",
    ]).asBot,
    true,
  );
});

Deno.test("parses comments reply command", () => {
  assertEquals(
    parseArgs([
      "comments",
      "reply",
      "README.md",
      "1",
      "Need",
      "more",
      "details.",
    ]),
    {
      asBot: false,
      command: "comments-reply",
      commentId: "1",
      file: "README.md",
      force: false,
      host: "127.0.0.1",
      keepAlive: false,
      open: true,
      port: 3334,
      replyBody: "Need more details.",
    },
  );
});

Deno.test("parses comments rm command", () => {
  assertEquals(parseArgs(["comments", "rm", "README.md"]), {
    asBot: false,
    command: "comments-rm",
    file: "README.md",
    force: false,
    host: "127.0.0.1",
    keepAlive: false,
    open: true,
    port: 3334,
  });
  assertEquals(
    parseArgs(["comments", "rm", "README.md", "--force"]),
    {
      asBot: false,
      command: "comments-rm",
      file: "README.md",
      force: true,
      host: "127.0.0.1",
      keepAlive: false,
      open: true,
      port: 3334,
    },
  );
});

Deno.test("parses bot attribution for CLI comments and replies", () => {
  assertEquals(
    parseArgs([
      "comments",
      "add",
      "README.md",
      "2",
      "4",
      "Automated comment",
      "--as-bot",
    ]),
    {
      asBot: true,
      command: "comments-add",
      commentBody: "Automated comment",
      endLine: 4,
      file: "README.md",
      force: false,
      host: "127.0.0.1",
      keepAlive: false,
      open: true,
      port: 3334,
      startLine: 2,
    },
  );
  assertEquals(
    parseArgs([
      "comments",
      "reply",
      "README.md",
      "1",
      "Automated reply",
      "--as-bot",
    ]).asBot,
    true,
  );
});

Deno.test("parses help", () => {
  assertEquals(parseArgs(["--help"]).help, true);
  assertEquals(parseArgs(["start", "--help"]).help, true);
  assertMatch(usage, /Defaults to 3334/);
  assertMatch(usage, /sadoku start <file\.md\|url>/);
  assertMatch(usage, /comments list/);
  assertMatch(usage, /comments inspect/);
  assertMatch(usage, /comments add/);
  assertMatch(usage, /comments reply/);
  assertMatch(usage, /comments resolve/);
  assertMatch(usage, /comments rm/);
  assertMatch(usage, /comments inspect <file\.md\|url>/);
  assertMatch(usage, /--keep-alive/);
});

Deno.test("parses version", () => {
  assertEquals(parseArgs(["--version"]).version, true);
  assertEquals(parseArgs(["-v"]).version, true);
  assertMatch(usage, /--version/);
});

Deno.test("uses the development version by default", () => {
  assertEquals(version, "0.0.0-dev");
});

Deno.test("throws usage errors for invalid options", () => {
  assertInstanceOf(
    assertThrows(() => parseArgs(["start", "README.md", "--port", "nope"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["start", "README.md", "--unknown"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["start", "README.md", "--as-bot"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["start", "README.md", "--port"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["start", "README.md", "--host"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["start", "a.md", "b.md"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["README.md"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["preview", "README.md"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["comments", "list", "--port", "4000"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() =>
      parseArgs(["comments", "inspect", "README.md", "--as-bot"])
    ),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() =>
      parseArgs(["comments", "rm", "README.md", "--port", "4000"])
    ),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["comments", "inspect"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["comments", "resolve", "README.md"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["comments", "reply", "README.md", "1"])),
    CliUsageError,
  );
});
