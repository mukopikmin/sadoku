import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";

const workflow = await Deno.readTextFile(
  new URL("../.github/workflows/cloud_run_proxy.yml", import.meta.url),
);
// Execute the actual deployment step with a fake gcloud; never contact GCP.
const deployment = workflow.split(
  "      - name: Update existing proxy and promote ready revision\n",
)[1].split("        run: |\n")[1].split("\n").map((line) =>
  line.startsWith("          ") ? line.slice(10) : line
).join("\n");

const image =
  `us-central1-docker.pkg.dev/example-project/images/revision-proxy@sha256:${
    "a".repeat(64)
  }`;

for (
  const scenario of [
    { name: "promotes the ready revision after an image-only update" },
    { name: "leaves traffic unchanged if update fails", updateFailure: "1" },
    { name: "rejects an image outside the proxy repository", image: "other" },
    { name: "rejects missing service configuration", service: "" },
    { name: "rejects malformed ready revisions", revision: "unexpected" },
    { name: "reports traffic promotion failures", promotionFailure: "1" },
  ]
) {
  Deno.test({
    name: `Cloud Run proxy deployment ${scenario.name}`,
    ignore: Deno.build.os === "windows",
    async fn() {
      const directory = await Deno.makeTempDir({ prefix: "sadoku-proxy-cd-" });
      try {
        const log = join(directory, "calls");
        await Deno.writeTextFile(log, "");
        const gcloud = join(directory, "gcloud");
        await Deno.writeTextFile(
          gcloud,
          `#!/bin/sh
printf '%s\\n' "$*" >> "$CALL_LOG"
case "$1 $2 $3" in
  'run services update')
    [ "$UPDATE_FAILURE" != 1 ] || exit 1
    printf '%s\\n' "$READY_REVISION"
    ;;
  'run services update-traffic')
    [ "$PROMOTION_FAILURE" != 1 ] || exit 1
    ;;
  *) exit 2 ;;
esac
`,
        );
        await Deno.chmod(gcloud, 0o755);
        const result = await new Deno.Command("sh", {
          args: ["-c", 'exec /bin/bash -c "$1"', "proxy-test", deployment],
          clearEnv: true,
          env: {
            PATH: `${directory}:/usr/bin:/bin`,
            PROJECT_ID: "example-project",
            REGION: "us-central1",
            REPOSITORY: "images",
            SERVICE: scenario.service ?? "revision-proxy",
            IMAGE: scenario.image ?? image,
            CALL_LOG: log,
            GITHUB_STEP_SUMMARY: join(directory, "summary"),
            READY_REVISION: scenario.revision ?? "revision-proxy-00002-test",
            UPDATE_FAILURE: scenario.updateFailure ?? "0",
            PROMOTION_FAILURE: scenario.promotionFailure ?? "0",
          },
          stdout: "piped",
          stderr: "piped",
        }).output();
        const calls = (await Deno.readTextFile(log)).trim().split("\n").filter(
          Boolean,
        );
        const invalidConfig = scenario.image !== undefined ||
          scenario.service !== undefined;
        assertEquals(
          result.code,
          Object.keys(scenario).length === 1 ? 0 : 1,
          new TextDecoder().decode(result.stderr),
        );
        assertEquals(
          calls.length,
          invalidConfig
            ? 0
            : scenario.updateFailure || scenario.revision
            ? 1
            : 2,
        );
        if (calls.length > 0) {
          assertEquals(
            calls[0],
            `run services update revision-proxy --project example-project --region us-central1 --image ${image} --no-traffic --quiet --format=value(status.latestReadyRevisionName)`,
          );
        }
        if (calls.length === 2) {
          assertEquals(
            calls[1],
            "run services update-traffic revision-proxy --project example-project --region us-central1 --to-revisions revision-proxy-00002-test=100 --quiet",
          );
        }
        if (result.code === 0) {
          assertStringIncludes(
            await Deno.readTextFile(join(directory, "summary")),
            "revision-proxy-00002-test",
          );
        }
      } finally {
        await Deno.remove(directory, { recursive: true });
      }
    },
  });
}
