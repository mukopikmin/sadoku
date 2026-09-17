import { assertEquals, assertRejects } from "@std/assert";
import {
  listGitHubPullDocuments,
  readGitHubMarkdownSource,
  type RunGitHubCommand,
} from "./github_pull.ts";

const encoder = new TextEncoder();
const pull = {
  owner: "octo",
  repo: "repo",
  pullNumber: 7,
  url: "https://github.com/octo/repo/pull/7",
};
const result = (value: unknown, code = 0, stderr = "") => ({
  code,
  stderr: encoder.encode(stderr),
  stdout: encoder.encode(
    typeof value === "string" ? value : JSON.stringify(value),
  ),
});

Deno.test("GitHub pull adapter uses gh for every page and filters files", async () => {
  const calls: string[][] = [];
  const run: RunGitHubCommand = (args) => {
    calls.push([...args]);
    const endpoint = args.at(-1)!;
    if (endpoint.endsWith("/pulls/7")) {
      return Promise.resolve(result({ head: { sha: "abc123" } }));
    }
    if (endpoint.includes("&page=1")) {
      return Promise.resolve(result([
        ...Array.from(
          { length: 97 },
          (_, index) => ({ filename: `src/${index}.ts` }),
        ),
        { filename: "README.md", status: "modified" },
        { filename: "old.md", status: "removed" },
        { filename: "src/app.ts", status: "modified" },
      ]));
    }
    return Promise.resolve(
      result([{ filename: "guides/setup.markdown", status: "added" }]),
    );
  };

  const documents = await listGitHubPullDocuments(pull, { run, maxFiles: 10 });
  assertEquals(documents.map((document) => document.relativePath), [
    "README.md",
    "guides/setup.markdown",
  ]);
  assertEquals(
    documents[0].filePath,
    "https://api.github.com/repos/octo/repo/contents/README.md?ref=abc123",
  );
  assertEquals(calls.map((args) => args.slice(0, 3)), [
    ["api", "--hostname", "github.com"],
    ["api", "--hostname", "github.com"],
    ["api", "--hostname", "github.com"],
  ]);
  assertEquals(
    calls.flat().some((argument) => argument.toLowerCase().includes("token")),
    false,
  );
});

Deno.test("GitHub pull adapter applies extensions and max-files", async () => {
  const run: RunGitHubCommand = (args) =>
    Promise.resolve(
      result(
        args.at(-1)!.endsWith("/pulls/7")
          ? { head: { sha: "sha" } }
          : [{ filename: "one.mdx" }, { filename: "two.mdx" }],
      ),
    );
  const documents = await listGitHubPullDocuments(pull, {
    run,
    markdownExtensions: [".mdx"],
    maxFiles: 1,
  });
  assertEquals(documents.map((document) => document.relativePath), ["one.mdx"]);
});

Deno.test("GitHub pull adapter maps gh authentication and pagination errors", async () => {
  await assertRejects(
    () =>
      listGitHubPullDocuments(pull, {
        run: () => Promise.resolve(result("", 1, "please run gh auth login")),
      }),
    Error,
    "gh auth login --hostname github.com",
  );
  let calls = 0;
  await assertRejects(
    () =>
      listGitHubPullDocuments(pull, {
        run: () => {
          calls += 1;
          if (calls === 1) {
            return Promise.resolve(result({ head: { sha: "sha" } }));
          }
          if (calls === 2) {
            return Promise.resolve(
              result(
                Array.from(
                  { length: 100 },
                  () => ({ filename: "file.ts" }),
                ),
              ),
            );
          }
          return Promise.resolve(result("", 1, "API rate limit exceeded"));
        },
      }),
    Error,
    "Failed to list page 2 of GitHub pull request files: GitHub API rate limit exceeded",
  );
});

Deno.test("GitHub pull adapter reads Markdown through gh without exposing credentials", async () => {
  let received: readonly string[] = [];
  const markdown = await readGitHubMarkdownSource(
    "https://api.github.com/repos/octo/repo/contents/docs/guide.md?ref=abc123",
    (args) => {
      received = args;
      return Promise.resolve(result("# Guide\n"));
    },
  );
  assertEquals(markdown, "# Guide\n");
  assertEquals(received, [
    "api",
    "--hostname",
    "github.com",
    "-H",
    "Accept: application/vnd.github.raw+json",
    "repos/octo/repo/contents/docs/guide.md?ref=abc123",
  ]);
});
