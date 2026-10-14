import { renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { validDomain, validOrigin } from "../src/index.ts";

export function deploymentConfig(values: Record<string, string | undefined>) {
  function required(name: string): string {
    const value = values[name];
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  }
  function originURL(name: string): URL {
    const value = required(name);
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      url.pathname !== "/" || url.search || url.hash ||
      !validDomain(url.hostname) || !url.hostname.endsWith(".run.app")
    ) throw new Error(`Invalid ${name}`);
    return url;
  }

  const domain = required("BASE_DOMAIN");
  const zone = required("CLOUDFLARE_ZONE_ID");
  const account = required("CLOUDFLARE_ACCOUNT_ID");
  const name = required("WORKER_NAME");
  const tag = required("CLOUD_RUN_SAMPLE_TAG");
  const taggedURL = originURL("CLOUD_RUN_SAMPLE_TAG_URL");
  originURL("CLOUD_RUN_SERVICE_URL"); // Confirm the observed service URL too.
  if (!validDomain(domain)) throw new Error("Invalid BASE_DOMAIN");
  if (!/^[a-f0-9]{32}$/.test(zone) || !/^[a-f0-9]{32}$/.test(account)) {
    throw new Error("Invalid Cloudflare account or zone ID");
  }
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(name)) {
    throw new Error("Invalid WORKER_NAME");
  }
  if (!/^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tag) || tag.includes("---")) {
    throw new Error("Invalid CLOUD_RUN_SAMPLE_TAG");
  }
  if (!taggedURL.hostname.startsWith(`${tag}---`)) {
    throw new Error("Observed Cloud Run URL does not match the sample tag");
  }
  const host = taggedURL.hostname.slice(tag.length + 3);
  if (!validOrigin(host)) {
    throw new Error("Invalid observed Cloud Run tag host");
  }
  return {
    name,
    account_id: account,
    main: "src/index.ts",
    compatibility_date: "2026-10-09",
    workers_dev: false,
    preview_urls: false,
    cache: { enabled: false },
    routes: [{ pattern: `*.${domain}/*`, zone_id: zone }],
    vars: { BASE_DOMAIN: domain, CLOUD_RUN_TAG_HOST: host },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = deploymentConfig(process.env);
  if (process.env.GITHUB_ACTIONS === "true") {
    // The observed URL is masked as a secret, but the derived hostname also
    // needs its own mask before Wrangler prints bindings.
    console.log(`::add-mask::${config.vars.CLOUD_RUN_TAG_HOST}`);
  }
  const temporary = `.wrangler.deploy-${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temporary, "wrangler.deploy.json");
  } finally {
    rmSync(temporary, { force: true });
  }
}
