import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
} from "@std/assert";

Deno.test("publish workflow preserves the release candidate across checkout", async () => {
  const workflow = await Deno.readTextFile(
    new URL("../.github/workflows/release.yml", import.meta.url),
  );

  assertStringIncludes(
    workflow,
    "CANDIDATE_DIR: ${{ runner.temp }}/release-candidate",
  );
  assertEquals(
    workflow.match(
      /CANDIDATE_DIR: \$\{\{ runner\.temp \}\}\/release-candidate/g,
    )?.length,
    4,
  );
  assertStringIncludes(
    workflow,
    'gh run download "${PREPARE_RUN_ID}" --repo "${GITHUB_REPOSITORY}" --name release-candidate --dir "${CANDIDATE_DIR}"',
  );
  assertStringIncludes(
    workflow,
    'gh release create "${TAG}" "${CANDIDATE_DIR}"/dist/*',
  );
  assertFalse(
    /(?:^|[\s"'])candidate\/(?:dist|release-)/m.test(workflow),
  );

  const downloadIndex = workflow.indexOf("Download approved release candidate");
  const checkoutIndex = workflow.indexOf("Checkout approved commit");
  const publishIndex = workflow.indexOf("Publish GitHub release");
  assert(downloadIndex < checkoutIndex && checkoutIndex < publishIndex);
});
