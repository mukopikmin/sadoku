import { assertEquals, assertStringIncludes } from "@std/assert";

// Exercise the actual inline action without contacting GitHub.
const workflow = await Deno.readTextFile(
  new URL("../.github/workflows/cloud_run_preview.yml", import.meta.url),
);
const script = workflow
  .split("      - name: Create or update preview comment\n")[1]
  .split("          script: |\n")[1]
  .split("\n  cleanup:")[0]
  .split("\n")
  .map((line) => line.replace(/^ {12}/, ""))
  .join("\n");
const runScript = new Function(
  "github",
  "context",
  "core",
  "process",
  `return (async () => {\n${script}\n})();`,
);
const head = "a".repeat(40);
const marker = "<!-- sadoku-cloud-run-preview -->";
const url = "https://preview.example.com/revisions/pr-42/";

type Comment = {
  id: number;
  user: { login: string } | null;
  body: string | null;
};

async function runScenario(
  { comments = [], state = "open", currentHead = head }: {
    comments?: Comment[];
    state?: string;
    currentHead?: string;
  } = {},
) {
  const writes: { operation: string; params: Record<string, unknown> }[] = [];
  let listed = false;
  const listComments = () => {};
  await runScript(
    {
      rest: {
        pulls: {
          get: (params: unknown) => {
            assertEquals(params, {
              owner: "owner",
              repo: "sadoku",
              pull_number: 42,
            });
            return { data: { state, head: { sha: currentHead } } };
          },
        },
        issues: {
          listComments,
          createComment: (params: Record<string, unknown>) => {
            writes.push({ operation: "create", params });
          },
          updateComment: (params: Record<string, unknown>) => {
            writes.push({ operation: "update", params });
          },
        },
      },
      paginate: (method: unknown, params: unknown) => {
        assertEquals(method, listComments);
        assertEquals(params, {
          owner: "owner",
          repo: "sadoku",
          issue_number: 42,
          per_page: 100,
        });
        listed = true;
        return comments;
      },
    },
    {
      repo: { owner: "owner", repo: "sadoku" },
      payload: { pull_request: { number: 42, head: { sha: head } } },
      serverUrl: "https://github.com",
      runId: 123,
    },
    { info: () => {} },
    { env: { PREVIEW_URL: url } },
  );
  return { writes, listed };
}

Deno.test("preview comment includes the ready URL, deployed commit and run link", async () => {
  const { writes } = await runScenario();
  assertEquals(writes.length, 1);
  assertEquals(writes[0].operation, "create");
  assertEquals(writes[0].params.issue_number, 42);
  const body = String(writes[0].params.body);
  assertStringIncludes(body, marker);
  assertStringIncludes(body, url);
  assertStringIncludes(body, `Commit: \`${head}\``);
  assertStringIncludes(
    body,
    "https://github.com/owner/sadoku/actions/runs/123",
  );
});

Deno.test("preview redeployment updates the existing bot comment from paginated results", async () => {
  const { writes } = await runScenario({
    comments: [
      { id: 1, user: { login: "github-actions[bot]" }, body: "Other job" },
      { id: 2, user: { login: "contributor" }, body: marker },
      { id: 3, user: null, body: null },
      { id: 4, user: { login: "github-actions[bot]" }, body: `${marker}\nOld` },
    ],
  });
  assertEquals(writes.length, 1);
  assertEquals(writes[0].operation, "update");
  assertEquals(writes[0].params.comment_id, 4);
  assertStringIncludes(String(writes[0].params.body), url);
});

Deno.test("preview comment never overwrites a contributor's comment with the marker", async () => {
  const { writes } = await runScenario({
    comments: [{ id: 2, user: { login: "contributor" }, body: marker }],
  });
  assertEquals(writes.length, 1);
  assertEquals(writes[0].operation, "create");
});

Deno.test("closed PRs and superseded deployments do not list or write comments", async () => {
  for (
    const scenario of [
      { state: "closed" },
      { currentHead: "b".repeat(40) },
    ]
  ) {
    assertEquals(await runScenario(scenario), { writes: [], listed: false });
  }
});
