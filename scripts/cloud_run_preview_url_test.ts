import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";

const workflow = await Deno.readTextFile(
  new URL("../.github/workflows/cloud_run_preview.yml", import.meta.url),
);
const script = workflow
  .split("      - name: Verify revision readiness and resolve preview URL\n")[1]
  .split("        run: |\n")[1]
  .split("\n      - name: Create or update preview comment")[0]
  .split("\n")
  .map((line) => line.replace(/^ {10}/, ""))
  .join("\n");

async function resolvePreview(
  origin: string | undefined,
  {
    ready = true,
    proxyService = "revision-proxy",
    proxyRegion = "asia-northeast1",
  } = {},
) {
  const directory = await Deno.makeTempDir({ prefix: "sadoku-preview-url-" });
  try {
    await Deno.writeTextFile(join(directory, "preview.sh"), script);
    const gcloud = join(directory, "gcloud");
    await Deno.writeTextFile(
      gcloud,
      `#!/bin/sh
set -eu
if [ "$1 $2 $3" = 'run services describe' ]; then
  case "$4" in
    revision-proxy)
      [ "$5 $6 $7 $8" = "--project example-project --region $EXPECTED_PROXY_REGION" ]
      cat "$FIXTURES/proxy.json" ;;
    sadoku)
      [ "$5 $6 $7 $8" = '--project example-project --region asia-northeast1' ]
      cat "$FIXTURES/backend.json" ;;
    *) exit 1 ;;
  esac
elif [ "$1 $2 $3 $4" = 'run revisions describe sadoku-revision' ]; then
  [ "$5 $6 $7 $8" = '--project example-project --region asia-northeast1' ]
  cat "$FIXTURES/revision.json"
else
  exit 1
fi
`,
    );
    await Deno.chmod(gcloud, 0o755);
    await Deno.writeTextFile(
      join(directory, "proxy.json"),
      JSON.stringify({
        spec: {
          template: {
            spec: {
              containers: [{
                env: origin === undefined
                  ? []
                  : [{ name: "PUBLIC_ORIGIN", value: origin }],
              }],
            },
          },
        },
      }),
    );
    await Deno.writeTextFile(
      join(directory, "backend.json"),
      JSON.stringify({
        status: {
          traffic: [{
            tag: "pr-42",
            revisionName: "sadoku-revision",
            url: "https://pr-42---private-backend.run.app",
          }],
        },
      }),
    );
    await Deno.writeTextFile(
      join(directory, "revision.json"),
      JSON.stringify({
        status: {
          conditions: [{ type: "Ready", status: ready ? "True" : "False" }],
        },
      }),
    );
    const output = join(directory, "output");
    const summary = join(directory, "summary");
    await Deno.writeTextFile(output, "");
    await Deno.writeTextFile(summary, "");
    const result = await new Deno.Command("sh", {
      args: ["-c", 'exec bash "$1"', "preview", join(directory, "preview.sh")],
      clearEnv: true,
      env: {
        PATH: `${directory}:/usr/bin:/bin`,
        FIXTURES: directory,
        PROJECT_ID: "example-project",
        REGION: "asia-northeast1",
        SERVICE: "sadoku",
        PROXY_SERVICE: proxyService,
        PROXY_REGION: proxyRegion,
        EXPECTED_PROXY_REGION: proxyRegion,
        PR_NUMBER: "42",
        REVISION: "sadoku-revision",
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    return {
      code: result.code,
      error: new TextDecoder().decode(result.stderr),
      output: await Deno.readTextFile(output),
      summary: await Deno.readTextFile(summary),
    };
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
}

Deno.test({
  name: "preview links use the proxy's custom domain and revision path",
  ignore: Deno.build.os === "windows",
  async fn() {
    for (
      const origin of [
        "https://preview.example.com",
        "https://preview.example.com/",
      ]
    ) {
      const result = await resolvePreview(origin);
      assertEquals(result.code, 0, result.error);
      assertEquals(
        result.output,
        "url=https://preview.example.com/revisions/pr-42/\n",
      );
      assertStringIncludes(
        result.summary,
        "https://preview.example.com/revisions/pr-42/",
      );
      assertEquals(result.summary.includes("run.app"), false);
    }
  },
});

Deno.test({
  name: "missing or unsafe proxy origins never publish a backend URL",
  ignore: Deno.build.os === "windows",
  async fn() {
    for (
      const origin of [
        undefined,
        "",
        "http://preview.example.com",
        "https://preview.example.com/path",
        "https://user@preview.example.com",
        "https://preview.example.com?q=1",
        "https://preview.example.com#fragment",
      ]
    ) {
      const result = await resolvePreview(origin);
      assertEquals(result.code === 0, false, `Accepted origin: ${origin}`);
      assertEquals(result.output, "");
      assertEquals(result.summary, "");
    }
  },
});

Deno.test({
  name: "unready revisions and missing proxy services do not publish links",
  ignore: Deno.build.os === "windows",
  async fn() {
    for (
      const scenario of [{ ready: false }, { proxyService: "" }, {
        proxyService: "missing-proxy",
      }]
    ) {
      const result = await resolvePreview(
        "https://preview.example.com",
        scenario,
      );
      assertEquals(result.code === 0, false);
      assertEquals(result.output, "");
      assertEquals(result.summary, "");
    }
  },
});

Deno.test({
  name:
    "proxy URL lookup uses its own region while backend checks keep the backend region",
  ignore: Deno.build.os === "windows",
  async fn() {
    const result = await resolvePreview("https://preview.example.com", {
      proxyRegion: "asia-northeast2",
    });
    assertEquals(result.code, 0, result.error);
    assertEquals(
      result.output,
      "url=https://preview.example.com/revisions/pr-42/\n",
    );
  },
});
