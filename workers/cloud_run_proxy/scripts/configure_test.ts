import { deepStrictEqual, throws } from "node:assert/strict";
import { deploymentConfig } from "./configure.ts";

const values = {
  BASE_DOMAIN: "api.example.com",
  CLOUDFLARE_ZONE_ID: "a".repeat(32),
  CLOUDFLARE_ACCOUNT_ID: "b".repeat(32),
  WORKER_NAME: "sadoku-cloud-run-proxy",
  CLOUD_RUN_SERVICE_URL: "https://api-123456789.asia-northeast1.run.app",
  CLOUD_RUN_SAMPLE_TAG: "pr-42",
  CLOUD_RUN_SAMPLE_TAG_URL: "https://pr-42---api-hash-an.a.run.app",
};

Deno.test("derives a stable opaque host from an observed tag URL, independently of status.url", () => {
  const config = deploymentConfig(values);
  deepStrictEqual(config.vars, {
    BASE_DOMAIN: values.BASE_DOMAIN,
    CLOUD_RUN_TAG_HOST: "api-hash-an.a.run.app",
  });
  deepStrictEqual(config.routes, [{
    pattern: "*.api.example.com/*",
    zone_id: values.CLOUDFLARE_ZONE_ID,
  }]);
});

Deno.test("also supports observed deterministic tag URLs", () => {
  const config = deploymentConfig({
    ...values,
    CLOUD_RUN_SAMPLE_TAG_URL:
      "https://pr-42---api-123456789.asia-northeast1.run.app",
  });
  deepStrictEqual(
    config.vars.CLOUD_RUN_TAG_HOST,
    "api-123456789.asia-northeast1.run.app",
  );
});

Deno.test("rejects missing deployment settings", () => {
  for (const key of Object.keys(values)) {
    throws(() => deploymentConfig({ ...values, [key]: undefined }), /Missing/);
  }
});

Deno.test("rejects injected hosts, paths, mismatched tags and invalid routes", () => {
  for (
    const change of [
      { CLOUD_RUN_SAMPLE_TAG_URL: "https://pr-42---evil.test" },
      { CLOUD_RUN_SAMPLE_TAG_URL: "https://pr-42---api.run.app.evil.test" },
      { CLOUD_RUN_SAMPLE_TAG_URL: "http://pr-42---api.run.app" },
      { CLOUD_RUN_SAMPLE_TAG_URL: "https://user@pr-42---api.run.app" },
      { CLOUD_RUN_SAMPLE_TAG_URL: "https://pr-42---api.run.app/path" },
      { CLOUD_RUN_SAMPLE_TAG_URL: "https://pr-42---api.run.app?q=1" },
      { CLOUD_RUN_SAMPLE_TAG_URL: "https://pr-42---api.run.app#fragment" },
      { CLOUD_RUN_SAMPLE_TAG_URL: "https://pr-42---api.run.app:8443" },
      { CLOUD_RUN_SAMPLE_TAG_URL: "https://wrong-tag---api.run.app" },
      { CLOUD_RUN_SAMPLE_TAG_URL: "https://pr-42---old---api.run.app" },
      { CLOUD_RUN_SERVICE_URL: "https://evil.test" },
      { CLOUD_RUN_SAMPLE_TAG: "bad.tag" },
      { BASE_DOMAIN: "*.api.example.com" },
      { BASE_DOMAIN: "api.example.com/*" },
      { CLOUDFLARE_ZONE_ID: "not-a-zone" },
      { WORKER_NAME: "bad/worker" },
    ]
  ) throws(() => deploymentConfig({ ...values, ...change }));
});
