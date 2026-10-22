import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";
import semver from "semver";

/**
 * @param {Record<string, string | undefined>} engines
 * @param {Record<string, string | undefined>} versions
 * @returns {string[]}
 */
export function getEngineErrors(engines, versions) {
  const errors = [];
  for (const runtime of ["node", "deno"]) {
    const range = engines[runtime];
    if (!range || semver.validRange(range) === null) {
      errors.push(
        `package.json engines.${runtime} must be a valid SemVer range.`,
      );
      continue;
    }
    const version = versions[runtime];
    if (!version || !semver.satisfies(version, range)) {
      errors.push(
        `${runtime} ${version ?? "missing"} does not satisfy ${range}.`,
      );
    }
  }
  return errors;
}

if (
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    const { engines } = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    const denoOutput = execFileSync("deno", ["--version"], {
      encoding: "utf8",
    });
    const versions = {
      node: process.versions.node,
      deno: /^deno (\S+)/m.exec(denoOutput)?.[1],
    };
    const errors = getEngineErrors(engines ?? {}, versions);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      `Runtime requirements satisfied: node ${versions.node}, deno ${versions.deno}.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
