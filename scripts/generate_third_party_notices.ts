type PackageLock = {
  packages?: Record<string, {
    version?: string;
    license?: string;
    resolved?: string;
  }>;
};

type DenoConfig = {
  imports?: Record<string, string>;
};

type DenoLock = {
  specifiers?: Record<string, string>;
  jsr?: Record<string, {
    dependencies?: string[];
  }>;
};

export type Notice = {
  name: string;
  version: string;
  license: string;
  source: string;
  licenseText?: string;
};

const textDecoder = new TextDecoder();

const readText = async (path: string): Promise<string> =>
  textDecoder.decode(await Deno.readFile(path));

const exists = async (path: string): Promise<boolean> => {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
};

const findLicenseText = async (
  packageDir: string,
): Promise<string | undefined> => {
  const candidates = [
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
    "license",
    "license.md",
    "license.txt",
    "COPYING",
    "COPYING.md",
    "COPYING.txt",
  ];

  for (const candidate of candidates) {
    const path = `${packageDir}/${candidate}`;
    if (await exists(path)) return await readText(path);
  }

  return undefined;
};

const packageNameFromLockPath = (path: string): string =>
  path.replace(/^node_modules\//, "");

const packageDirFromLockPath = (nodeModulesDir: string, path: string): string =>
  `${nodeModulesDir}/${packageNameFromLockPath(path)}`;

const readPackageJson = async (
  packageDir: string,
): Promise<Record<string, unknown> | undefined> => {
  const path = `${packageDir}/package.json`;
  if (!(await exists(path))) return undefined;
  return JSON.parse(await readText(path));
};

const repositoryUrl = (
  packageJson: Record<string, unknown> | undefined,
): string => {
  const repository = packageJson?.repository;
  if (typeof repository === "string") {
    return repository.includes("://")
      ? repository
      : `https://github.com/${repository}`;
  }
  if (
    repository && typeof repository === "object" && "url" in repository &&
    typeof repository.url === "string"
  ) {
    return repository.url;
  }
  return "";
};

const noticeKey = (notice: Notice): string =>
  `${notice.name}@${notice.version}`;

export const collectNpmNotices = async (
  lockPath = "src/preview/package-lock.json",
  nodeModulesDir = "src/preview/node_modules",
): Promise<Notice[]> => {
  const lock: PackageLock = JSON.parse(await readText(lockPath));
  const packages = lock.packages ?? {};
  const notices: Notice[] = [];

  for (const [path, metadata] of Object.entries(packages)) {
    if (!path.startsWith("node_modules/")) continue;
    if (!metadata.version || !metadata.license) continue;

    const packageDir = packageDirFromLockPath(nodeModulesDir, path);
    const packageJson = await readPackageJson(packageDir);
    notices.push({
      name: packageNameFromLockPath(path),
      version: metadata.version,
      license: metadata.license,
      source: repositoryUrl(packageJson) || metadata.resolved ||
        lockPath,
      licenseText: await findLicenseText(packageDir),
    });
  }

  return notices;
};

const packageFromEsmShSpecifier = (
  specifier: string,
): { name: string; version: string } | undefined => {
  const url = new URL(specifier);
  if (url.hostname !== "esm.sh") return undefined;

  const path = url.pathname.replace(/^\/+/, "");
  const scoped = path.startsWith("@");
  const packagePart = scoped
    ? path.split("/").slice(0, 2).join("/")
    : path.split("/")[0];
  const versionIndex = packagePart.lastIndexOf("@");
  if (versionIndex <= 0) return undefined;

  return {
    name: packagePart.slice(0, versionIndex),
    version: packagePart.slice(versionIndex + 1),
  };
};

const collectDirectEsmShNotices = async (): Promise<Notice[]> => {
  const config: DenoConfig = JSON.parse(await readText("deno.json"));
  const notices: Notice[] = [];

  for (const specifier of Object.values(config.imports ?? {})) {
    if (!specifier.startsWith("https://esm.sh/")) continue;
    const parsed = packageFromEsmShSpecifier(specifier);
    if (!parsed) continue;

    const packageDir = `node_modules/${parsed.name}`;
    const packageJson = await readPackageJson(packageDir);
    const license = typeof packageJson?.license === "string"
      ? packageJson.license
      : "UNKNOWN";

    notices.push({
      name: parsed.name,
      version: parsed.version,
      license,
      source: repositoryUrl(packageJson) || specifier,
      licenseText: await findLicenseText(packageDir),
    });
  }

  return notices;
};

type JsrPackageDefinition = Pick<Notice, "license" | "source">;

// JSR's lockfile format deliberately contains integrity and dependency data,
// but not licensing metadata. Keep audited metadata needed by release packages
// here rather than assigning every JSR package the same license.
const jsrPackageDefinitions: Record<string, JsrPackageDefinition> = {
  "@hono/hono": {
    license: "MIT",
    source: "https://github.com/honojs/hono",
  },
};

const jsrPackage = (
  value: string,
): { name: string; version?: string } | undefined => {
  const match = /^(?:jsr:)?(@[^/]+\/[^@/]+)(?:@([^/]+))?/.exec(value);
  return match ? { name: match[1], version: match[2] } : undefined;
};

const jsrMetadata = (name: string, version: string): JsrPackageDefinition => {
  const explicit = jsrPackageDefinitions[name];
  if (explicit) return explicit;
  if (name.startsWith("@std/")) {
    return {
      license: "MIT",
      source: `https://github.com/denoland/std/tree/main/${name.slice(5)}`,
    };
  }
  return {
    license: "UNKNOWN",
    source: `https://jsr.io/${name}@${version}`,
  };
};

export const collectDenoNotices = async (
  lockPath = "deno.lock",
): Promise<Notice[]> => {
  const lock: DenoLock = JSON.parse(await readText(lockPath));
  const resolved = new Map<string, string>();

  for (const [specifier, version] of Object.entries(lock.specifiers ?? {})) {
    const parsed = jsrPackage(specifier);
    if (parsed) resolved.set(parsed.name, version);
  }
  for (const [key, metadata] of Object.entries(lock.jsr ?? {})) {
    const parsed = jsrPackage(key);
    if (parsed?.version) resolved.set(parsed.name, parsed.version);
    for (const dependency of metadata.dependencies ?? []) {
      const dependencyPackage = jsrPackage(dependency);
      if (!dependencyPackage || resolved.has(dependencyPackage.name)) continue;
      const matchingSpecifier = Object.entries(lock.specifiers ?? {}).find(
        ([specifier]) => jsrPackage(specifier)?.name === dependencyPackage.name,
      );
      if (matchingSpecifier) {
        resolved.set(dependencyPackage.name, matchingSpecifier[1]);
      }
    }
  }

  const jsrPackages = [...resolved].map(([name, version]) => ({
    name,
    version,
    ...jsrMetadata(name, version),
  }));

  return [
    {
      name: "Deno runtime",
      version: Deno.version.deno,
      license: "MIT",
      source: "https://github.com/denoland/deno",
    },
    ...jsrPackages,
  ];
};

const normalizeLicenseText = (text: string): string =>
  text.trim().replace(/\r\n/g, "\n");

const renderTable = (notices: Notice[]): string => {
  const rows = [
    ["Package", "Version", "License", "Source"],
    ...notices.map((notice) => [
      notice.name,
      notice.version,
      notice.license,
      notice.source,
    ]),
  ];
  const widths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex].length))
  );
  const renderRow = (row: string[]): string =>
    `| ${row.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`;
  const separator = `| ${
    widths.map((width) => "-".repeat(width)).join(" | ")
  } |`;

  return [
    renderRow(rows[0]),
    separator,
    ...rows.slice(1).map(renderRow),
  ].join("\n");
};

export const render = (notices: Notice[]): string => {
  const sorted = notices.toSorted((a, b) =>
    a.name.localeCompare(b.name) || a.version.localeCompare(b.version)
  );

  const licenseTexts = sorted
    .filter((notice) => notice.licenseText)
    .map((notice) =>
      `## ${notice.name} ${notice.version}\n\n` +
      `License: ${notice.license}\n\n` +
      "```text\n" +
      `${normalizeLicenseText(notice.licenseText ?? "")}\n` +
      "```"
    ).join("\n\n");

  return `# Third Party Notices

This file is generated by \`deno task notices\`.

The sadoku release archives include a compiled Deno runtime and bundled
JavaScript assets. The following third-party components are included directly or
through bundled dependencies.

## Summary

${renderTable(sorted)}

## License Texts

${licenseTexts}
`;
};

export const uniqueNotices = (
  notices: Notice[],
): Notice[] => [
  ...new Map(notices.map((notice) => [noticeKey(notice), notice])).values(),
];

if (import.meta.main) {
  const outputPath = Deno.args[0] ?? "THIRD_PARTY_NOTICES.md";
  const notices = [
    ...await collectDenoNotices(),
    ...await collectDirectEsmShNotices(),
    ...await collectNpmNotices(),
  ];

  await Deno.writeTextFile(outputPath, render(uniqueNotices(notices)));
  console.log(`Generated ${outputPath}`);
}
