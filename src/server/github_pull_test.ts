import { assertEquals, assertRejects } from "@std/assert";
import {
  getGitHubPullSnapshot,
  listGitHubPullDocuments,
  readGitHubMarkdownSource,
  type RunGitHubCommand,
} from "./github_pull.ts";
import { monitorGitHubPull } from "./github_pull_monitor.ts";
import type {
  DirectorySession,
  DocumentStore,
} from "./usecase/document/mod.ts";

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

Deno.test("GitHub pull snapshot exposes the head SHA", async () => {
  const snapshot = await getGitHubPullSnapshot(pull, {
    run: (args) =>
      Promise.resolve(result(
        args.at(-1)!.endsWith("/pulls/7")
          ? { head: { sha: "snapshot-sha" } }
          : [],
      )),
  });
  assertEquals(snapshot, { headSha: "snapshot-sha", documents: [] });
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

const monitorFixture = () => {
  const stored = new Map<string, { filePath: string; id: number }>();
  const documentStore: DocumentStore = {
    ensure: (filePath) => {
      const document = stored.get(filePath) ??
        { id: stored.size + 1, filePath };
      stored.set(filePath, document);
      return Promise.resolve(document);
    },
    ensureMany: () => Promise.resolve([]),
    findByFilePath: (filePath) => Promise.resolve(stored.get(filePath)),
    findById: (id) =>
      Promise.resolve([...stored.values()].find((item) => item.id === id)),
    list: () => Promise.resolve([...stored.values()]),
  };
  const session: DirectorySession = {
    rootPath: pull.url,
    documents: [],
    documentsById: new Map(),
    githubPull: {
      owner: pull.owner,
      repo: pull.repo,
      pullNumber: pull.pullNumber,
      initialHeadSha: "old-sha",
      headSha: "old-sha",
    },
  };
  return { documentStore, session };
};

Deno.test("GitHub pull monitor does not refresh an unchanged SHA", async () => {
  const { documentStore, session } = monitorFixture();
  const controller = new AbortController();
  let notifications = 0;
  let waits = 0;
  await monitorGitHubPull({
    documentStore,
    session,
    run: () => Promise.resolve(result({ head: { sha: "old-sha" } })),
    notify: () => notifications++,
    logError: () => {},
    wait: () => {
      if (waits++ > 0) controller.abort();
      return Promise.resolve();
    },
  }, controller.signal);
  assertEquals(notifications, 0);
  assertEquals(session.githubPull?.headSha, "old-sha");
});

Deno.test("GitHub pull monitor refreshes added and removed Markdown documents", async () => {
  const { documentStore, session } = monitorFixture();
  session.documents.push({
    id: 99,
    filePath: "old",
    relativePath: "removed.md",
    title: "removed.md",
    deleted: false,
  });
  session.documentsById.set(99, session.documents[0]);
  const controller = new AbortController();
  let calls = 0;
  let notifications = 0;
  await monitorGitHubPull({
    documentStore,
    session,
    run: (args) => {
      calls++;
      return Promise.resolve(result(
        args.at(-1)!.includes("/files?")
          ? [{ filename: "added.md", status: "added" }]
          : { head: { sha: "new-sha" } },
      ));
    },
    notify: () => {
      notifications++;
      controller.abort();
    },
    logError: () => {},
    wait: () => Promise.resolve(),
  }, controller.signal);
  assertEquals(calls, 2);
  assertEquals(notifications, 1);
  assertEquals(session.githubPull, {
    owner: "octo",
    repo: "repo",
    pullNumber: 7,
    initialHeadSha: "old-sha",
    headSha: "new-sha",
  });
  assertEquals(session.documents.map((item) => item.relativePath), [
    "added.md",
  ]);
  assertEquals(session.documents[0].filePath.includes("ref=new-sha"), true);
  assertEquals(session.documentsById.has(99), false);
});

Deno.test("GitHub pull monitor logs API errors and continues polling", async () => {
  const { documentStore, session } = monitorFixture();
  const controller = new AbortController();
  const errors: string[] = [];
  let calls = 0;
  await monitorGitHubPull({
    documentStore,
    session,
    run: () => {
      calls++;
      return Promise.resolve(result("", 1, "API rate limit exceeded"));
    },
    notify: () => {},
    logError: (message) => errors.push(message),
    wait: () => {
      if (calls === 1) controller.abort();
      return Promise.resolve();
    },
  }, controller.signal);
  assertEquals(calls, 1);
  assertEquals(errors.length, 1);
  assertEquals(errors[0].includes("rate limit"), true);
});

Deno.test("GitHub pull monitor aborts an in-flight head check without logging an error", async () => {
  const { documentStore, session } = monitorFixture();
  const controller = new AbortController();
  const errors: string[] = [];
  let receivedSignal: AbortSignal | undefined;
  const monitoring = monitorGitHubPull({
    documentStore,
    session,
    run: (_args, signal) => {
      receivedSignal = signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => reject(signal.reason),
          { once: true },
        );
      });
    },
    notify: () => {},
    logError: (message) => errors.push(message),
    wait: () => Promise.resolve(),
  }, controller.signal);

  await Promise.resolve();
  controller.abort();
  await monitoring;
  assertEquals(receivedSignal, controller.signal);
  assertEquals(errors, []);
});
