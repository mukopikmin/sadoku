import {
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertStringIncludes,
} from "@std/assert";
import { join } from "@std/path";

const workflow = await Deno.readTextFile(
  new URL("../.github/workflows/cloud_run_preview.yml", import.meta.url),
);
const script = workflow
  .split("      - name: Deploy tagged revision without traffic\n")[1]
  .split("        run: |\n")[1]
  .split("\n      - name: Verify revision readiness and resolve preview URL")[0]
  .split("\n")
  .map((line) => line.replace(/^ {10}/, ""))
  .join("\n");

const concurrency = (configuration: string, indent: number) => {
  const lines = configuration.split("\n");
  const start = lines.indexOf(`${" ".repeat(indent)}concurrency:`);
  assertNotEquals(start, -1, "Missing concurrency configuration.");
  const properties: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith(" ".repeat(indent + 2))) break;
    const [name, ...value] = line.trim().split(": ");
    properties[name] = value.join(": ");
  }
  return properties;
};

Deno.test("preview deployment and cleanup share a queue without canceling active or pending service updates", () => {
  const root = concurrency(workflow.split("\njobs:")[0], 0);
  const job = (name: string) =>
    workflow.split(`\n  ${name}:\n`)[1].split("\n    steps:")[0];
  const deploy = concurrency(job("deploy"), 4);
  const cleanup = concurrency(job("cleanup"), 4);
  assertEquals(deploy.group, cleanup.group);
  assertEquals(deploy.group.includes("${{"), false);
  assertNotEquals(deploy.group, root.group);
  for (const configuration of [root, deploy, cleanup]) {
    assertEquals(configuration["cancel-in-progress"], "false");
    assertEquals(configuration.queue, "max");
  }
  assertStringIncludes(root.group, "github.event.pull_request.number");
  assertStringIncludes(root.group, "github.ref");
});

async function deployPreview({
  service = "sadoku",
  tag = "pr-42",
  runId = "12345678901234567890",
  attempt = "1",
  fail = false,
} = {}) {
  const directory = await Deno.makeTempDir({
    prefix: "sadoku-preview-deploy-",
  });
  try {
    const scriptPath = join(directory, "deploy.sh");
    const output = join(directory, "output");
    const calls = join(directory, "calls");
    await Deno.writeTextFile(scriptPath, script);
    await Deno.writeTextFile(output, "");
    await Deno.writeTextFile(calls, "");
    await Deno.writeTextFile(
      join(directory, "gcloud"),
      `#!/bin/sh
set -eu
printf '%s\\n' "$@" > "$CALLS"
if [ "$FAIL_DEPLOY" = 'true' ]; then
  echo 'ABORTED: Conflict for resource' >&2
  exit 1
fi
# Another PR has replaced the latest revision in the shared service response.
printf '%s\\n' '{"status":{"latestCreatedRevisionName":"sadoku-another-pr"}}'
`,
    );
    await Deno.chmod(join(directory, "gcloud"), 0o755);
    const result = await new Deno.Command("sh", {
      args: ["-c", 'exec bash "$1"', "deploy", scriptPath],
      clearEnv: true,
      env: {
        PATH: `${directory}:/usr/bin:/bin`,
        CALLS: calls,
        FAIL_DEPLOY: String(fail),
        PROJECT_ID: "example-project",
        REGION: "asia-northeast1",
        SERVICE: service,
        IMAGE:
          `asia-northeast1-docker.pkg.dev/example-project/images/sadoku@sha256:${
            "a".repeat(64)
          }`,
        PREVIEW_TAG: tag,
        GITHUB_RUN_ID: runId,
        GITHUB_RUN_ATTEMPT: attempt,
        GITHUB_OUTPUT: output,
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    return {
      code: result.code,
      error: new TextDecoder().decode(result.stderr),
      output: await Deno.readTextFile(output),
      args: (await Deno.readTextFile(calls)).trim().split("\n").filter(Boolean),
    };
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
}

Deno.test({
  name:
    "preview deploy verifies the explicitly named revision even when another PR becomes latest",
  ignore: Deno.build.os !== "linux",
  async fn() {
    for (const tag of ["pr-42", "main"]) {
      const result = await deployPreview({ tag });
      assertEquals(result.code, 0, result.error);
      assertEquals(result.args.slice(0, 3), ["run", "deploy", "sadoku"]);
      const suffix = result.args[result.args.indexOf("--revision-suffix") + 1];
      assertMatch(suffix, /^p[a-f0-9]{12}$/);
      assertEquals(result.output, `revision=sadoku-${suffix}\n`);
      assertEquals(result.output.includes("sadoku-another-pr"), false);
      assertEquals(result.args[result.args.indexOf("--tag") + 1], tag);
      assertEquals(result.args.includes("--no-traffic"), true);
    }
  },
});

Deno.test({
  name:
    "preview revision names fit long service names and distinguish runs and reruns",
  ignore: Deno.build.os !== "linux",
  async fn() {
    const service = "s".repeat(49);
    const outputs = new Set<string>();
    for (
      const scenario of [
        { runId: "12345678901234567890", attempt: "1" },
        { runId: "12345678901234567890", attempt: "2" },
        { runId: "12345678901234567891", attempt: "1" },
      ]
    ) {
      const result = await deployPreview({ service, ...scenario });
      assertEquals(result.code, 0, result.error);
      const revision = result.output.trim().slice("revision=".length);
      assertEquals(revision.length <= 63, true);
      assertMatch(revision, /^[a-z][a-z0-9-]*[a-z0-9]$/);
      assertStringIncludes(revision, `${service}-p`);
      outputs.add(result.output);
    }
    assertEquals(outputs.size, 3);
  },
});

Deno.test({
  name:
    "failed preview deployments do not publish a revision for readiness checks",
  ignore: Deno.build.os !== "linux",
  async fn() {
    const result = await deployPreview({ fail: true });
    assertNotEquals(result.code, 0);
    assertStringIncludes(result.error, "ABORTED: Conflict for resource");
    assertEquals(result.output, "");
  },
});

Deno.test({
  name: "invalid preview deployment identifiers fail before invoking Cloud Run",
  ignore: Deno.build.os !== "linux",
  async fn() {
    for (
      const scenario of [
        { service: "s".repeat(50) },
        { tag: "pr-0" },
        { runId: "" },
        { runId: "123;false" },
        { attempt: "0" },
        { attempt: "invalid" },
      ]
    ) {
      const result = await deployPreview(scenario);
      assertNotEquals(result.code, 0);
      assertEquals(result.output, "");
      assertEquals(result.args, []);
    }
  },
});
