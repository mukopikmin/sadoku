import { assertEquals } from "@std/assert";

const workflow = await Deno.readTextFile(
  new URL("../.github/workflows/cloud_run_preview.yml", import.meta.url),
);
const script = workflow
  .split("      - name: Check changed PR files\n")[1]
  .split("          script: |\n")[1]
  .split("\n  build:")[0]
  .split("\n")
  .map((line) => line.replace(/^ {12}/, ""))
  .join("\n");
const runScript = new Function(
  "github",
  "context",
  "core",
  `return (async () => {\n${script}\n})();`,
);

type ChangedFile = { filename: string; previous_filename?: string };

async function applicationChanged(files: ChangedFile[]): Promise<string> {
  let output = "";
  const listFiles = () => {};
  await runScript(
    {
      rest: { pulls: { listFiles } },
      paginate: (method: unknown, params: unknown) => {
        assertEquals(method, listFiles);
        assertEquals(params, {
          owner: "owner",
          repo: "sadoku",
          pull_number: 42,
          per_page: 100,
        });
        return files;
      },
    },
    {
      repo: { owner: "owner", repo: "sadoku" },
      payload: { pull_request: { number: 42 } },
    },
    {
      setOutput: (name: string, value: string) => {
        assertEquals(name, "application");
        output = value;
      },
    },
  );
  return output;
}

Deno.test("preview skips proxy-only changes across all PR files", async () => {
  assertEquals(
    await applicationChanged([
      { filename: "proxy/revision_proxy.go" },
      { filename: "proxy/Dockerfile" },
      { filename: ".github/workflows/proxy_test.yml" },
      { filename: ".github/workflows/cloud_run_proxy.yml" },
    ]),
    "false",
  );
});

Deno.test("preview builds for application, build, workflow and fixture changes", async () => {
  for (
    const filename of [
      "src/main.ts",
      "src/preview/App.tsx",
      "deno.lock",
      "package-lock.json",
      "Dockerfile",
      ".dockerignore",
      "scripts/cloud_run_entrypoint.sh",
      "test/integration/fixtures/example.md",
      "README.md",
      ".github/workflows/cloud_run_preview.yml",
    ]
  ) {
    assertEquals(
      await applicationChanged([
        { filename: "proxy/revision_proxy.go" },
        { filename },
      ]),
      "true",
      filename,
    );
  }
});

Deno.test("preview builds when an application file is moved into proxy", async () => {
  assertEquals(
    await applicationChanged([{
      filename: "proxy/example.go",
      previous_filename: "src/example.go",
    }]),
    "true",
  );
});

Deno.test("preview builds conservatively when the PR file API reaches its limit", async () => {
  assertEquals(
    await applicationChanged(
      Array.from({ length: 3000 }, (_, i) => ({ filename: `proxy/${i}.go` })),
    ),
    "true",
  );
});

Deno.test("preview skips a PR with no changed files", async () => {
  assertEquals(await applicationChanged([]), "false");
});
