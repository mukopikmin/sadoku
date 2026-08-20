import { basename, dirname, join } from "@std/path";

export type UpdateChannel = "stable" | "nightly";

export type UpdateResult = {
  channel: UpdateChannel;
  currentVersion: string;
  targetVersion: string;
  updated: boolean;
};

export type UpdatePlan = {
  channel: UpdateChannel;
  currentVersion: string;
  targetVersion: string;
  target: string;
  executable: string;
  archive: string;
  downloadBaseUrl: string;
  updateAvailable: boolean;
};

type FileInfo = { isFile: boolean };

export type UpdateFileSystem = {
  chmod(path: string, mode: number): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
  makeTempDir(options?: Deno.MakeTempOptions): Promise<string>;
  makeTempFile(options?: Deno.MakeTempOptions): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
  remove(path: string, options?: Deno.RemoveOptions): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  stat(path: string): Promise<FileInfo>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
};

export type UpdateDependencies = {
  execPath(): string;
  fetch: typeof fetch;
  fs: UpdateFileSystem;
  platform: { os: string; arch: string };
  run(
    command: string,
    args: string[],
  ): Promise<{ success: boolean; output: string }>;
};

const repository = "https://github.com/mukopikmin/sadoku";
const apiRepository = "https://api.github.com/repos/mukopikmin/sadoku";

export const defaultUpdateChannel = (currentVersion: string): UpdateChannel =>
  /^nightly-\d{8}-[0-9a-f]+$/i.test(currentVersion) ? "nightly" : "stable";

export const releaseTarget = (
  platform: { os: string; arch: string },
): string => {
  if (platform.os === "linux" && platform.arch === "x86_64") return "linux-x64";
  if (platform.os === "darwin" && platform.arch === "aarch64") {
    return "darwin-arm64";
  }
  if (platform.os === "windows") {
    throw new Error("Self-update is not supported on Windows.");
  }
  throw new Error(
    `Self-update is not supported on ${platform.os}/${platform.arch}.`,
  );
};

export const archiveName = (
  channel: UpdateChannel,
  version: string,
  target: string,
): string =>
  channel === "nightly"
    ? `sadoku-nightly-${target}.tar.gz`
    : `sadoku-v${version}-${target}.tar.gz`;

const defaultDependencies = (): UpdateDependencies => ({
  execPath: () => Deno.execPath(),
  fetch,
  fs: {
    chmod: Deno.chmod,
    copyFile: Deno.copyFile,
    makeTempDir: Deno.makeTempDir,
    makeTempFile: Deno.makeTempFile,
    readFile: Deno.readFile,
    remove: Deno.remove,
    rename: Deno.rename,
    stat: Deno.stat,
    writeFile: Deno.writeFile,
  },
  platform: Deno.build,
  run: async (command, args) => {
    const result = await new Deno.Command(command, {
      args,
      stdout: "piped",
      stderr: "piped",
    }).output();
    return {
      success: result.success,
      output: new TextDecoder().decode(
        result.success ? result.stdout : result.stderr,
      ).trim(),
    };
  },
});

const download = async (
  fetcher: typeof fetch,
  url: string,
): Promise<Uint8Array> => {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { "User-Agent": "sadoku-update" },
      redirect: "follow",
    });
  } catch (error) {
    throw new Error(
      `Could not download ${url}: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
  if (!response.ok) {
    throw new Error(`Could not download ${url}: HTTP ${response.status}.`);
  }
  return new Uint8Array(await response.arrayBuffer());
};

const resolveStableVersion = async (fetcher: typeof fetch): Promise<string> => {
  const data = await download(fetcher, `${apiRepository}/releases/latest`);
  let tag: unknown;
  try {
    tag = JSON.parse(new TextDecoder().decode(data)).tag_name;
  } catch {
    throw new Error("GitHub returned an invalid latest release response.");
  }
  if (
    typeof tag !== "string" ||
    !/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag)
  ) {
    throw new Error(
      `GitHub returned an invalid stable release tag: ${String(tag)}.`,
    );
  }
  return tag.slice(1);
};

const parseJson = async (
  fetcher: typeof fetch,
  url: string,
): Promise<unknown> =>
  JSON.parse(new TextDecoder().decode(await download(fetcher, url)));

const resolveNightlyVersion = async (
  fetcher: typeof fetch,
): Promise<string> => {
  let sha: unknown;
  try {
    const ref = await parseJson(
      fetcher,
      `${apiRepository}/git/ref/tags/nightly`,
    );
    sha = (ref as { object?: { sha?: unknown } }).object?.sha;
  } catch {
    throw new Error("GitHub returned invalid nightly tag metadata.");
  }
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error("GitHub returned an invalid nightly commit hash.");
  }

  let date: unknown;
  try {
    const commit = await parseJson(fetcher, `${apiRepository}/commits/${sha}`);
    date = (commit as { commit?: { committer?: { date?: unknown } } }).commit
      ?.committer?.date;
  } catch {
    throw new Error("GitHub returned invalid nightly commit metadata.");
  }
  if (typeof date !== "string" || Number.isNaN(Date.parse(date))) {
    throw new Error("GitHub returned an invalid nightly commit date.");
  }
  const day = new Date(date).toISOString().slice(0, 10).replaceAll("-", "");
  return `nightly-${day}-${sha.slice(0, 8)}`;
};

export const verifyChecksum = async (
  archive: Uint8Array,
  checksumBytes: Uint8Array,
): Promise<void> => {
  const expected = new TextDecoder().decode(checksumBytes).trim();
  if (!/^[0-9a-fA-F]{64}$/.test(expected)) {
    throw new Error(
      "Release checksum is not a 64-digit hexadecimal SHA-256 value.",
    );
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(archive).buffer,
  );
  const actual = [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  if (actual !== expected.toLowerCase()) {
    throw new Error(
      "Release archive SHA-256 checksum mismatch; the existing binary was not changed.",
    );
  }
};

const parseBinaryVersion = (output: string): string => {
  const match = output.match(/^sadoku (\S+)$/m);
  if (!match) {
    throw new Error(
      "Downloaded archive does not contain a valid Sadoku binary.",
    );
  }
  return match[1];
};

const stableVersionParts = (version: string): number[] | undefined => {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match?.slice(1, 4).map(Number);
};

const updateIsNewer = (
  channel: UpdateChannel,
  currentVersion: string,
  targetVersion: string,
): boolean => {
  if (currentVersion === targetVersion) return false;

  if (channel === "nightly") {
    const currentDay = currentVersion.match(/^nightly-(\d{8})-[0-9a-f]+$/i)
      ?.[1];
    const targetDay = targetVersion.match(/^nightly-(\d{8})-[0-9a-f]+$/i)
      ?.[1];
    if (currentDay && targetDay && currentDay !== targetDay) {
      return targetDay > currentDay;
    }
    return true;
  }

  const current = stableVersionParts(currentVersion);
  const target = stableVersionParts(targetVersion);
  if (!current || !target) return true;
  for (let index = 0; index < current.length; index++) {
    if (target[index] !== current[index]) {
      return target[index] > current[index];
    }
  }

  // The release endpoint can return a prerelease-like tag. When the numeric
  // parts match, only replace a prerelease build with the final release.
  const currentIsPrerelease = currentVersion.includes("-");
  const targetIsPrerelease = targetVersion.includes("-");
  return currentIsPrerelease && !targetIsPrerelease;
};

export const checkForUpdate = async (
  currentVersion: string,
  requestedChannel?: UpdateChannel,
  dependencies: UpdateDependencies = defaultDependencies(),
): Promise<UpdatePlan> => {
  const channel = requestedChannel ?? defaultUpdateChannel(currentVersion);
  const target = releaseTarget(dependencies.platform);
  const executable = dependencies.execPath();
  if (/^deno(?:\.exe)?$/i.test(basename(executable))) {
    throw new Error(
      "Self-update is unavailable when Sadoku is run from source with deno run; install a compiled Sadoku binary first.",
    );
  }
  const executableInfo = await dependencies.fs.stat(executable).catch(() =>
    undefined
  );
  if (!executableInfo?.isFile) {
    throw new Error(
      `The running executable is not a compiled Sadoku binary: ${executable}`,
    );
  }
  const currentProbe = await dependencies.run(executable, ["--version"])
    .catch(() => ({ success: false, output: "" }));
  if (!currentProbe.success) {
    throw new Error(
      `The running executable is not a compiled Sadoku binary: ${executable}`,
    );
  }
  parseBinaryVersion(currentProbe.output);

  const targetVersion = channel === "stable"
    ? await resolveStableVersion(dependencies.fetch)
    : await resolveNightlyVersion(dependencies.fetch);
  const archiveVersion = channel === "nightly" ? "nightly" : targetVersion;
  const archive = archiveName(channel, archiveVersion, target);
  const tag = channel === "nightly" ? "nightly" : `v${targetVersion}`;
  return {
    archive,
    channel,
    currentVersion,
    downloadBaseUrl: `${repository}/releases/download/${tag}`,
    executable,
    target,
    targetVersion,
    updateAvailable: updateIsNewer(channel, currentVersion, targetVersion),
  };
};

export const installUpdate = async (
  plan: UpdatePlan,
  dependencies: UpdateDependencies = defaultDependencies(),
): Promise<UpdateResult> => {
  const {
    archive,
    channel,
    currentVersion,
    downloadBaseUrl,
    executable,
    targetVersion,
  } = plan;
  if (!plan.updateAvailable) {
    return { channel, currentVersion, targetVersion, updated: false };
  }
  const [archiveBytes, checksumBytes] = await Promise.all([
    download(dependencies.fetch, `${downloadBaseUrl}/${archive}`),
    download(dependencies.fetch, `${downloadBaseUrl}/${archive}.sha256`),
  ]);
  await verifyChecksum(archiveBytes, checksumBytes);

  const workDir = await dependencies.fs.makeTempDir({
    prefix: "sadoku-update-",
  });
  let stagedPath: string | undefined;
  try {
    const archivePath = join(workDir, archive);
    await dependencies.fs.writeFile(archivePath, archiveBytes);
    const extracted = await dependencies.run("tar", [
      "-xzf",
      archivePath,
      "-C",
      workDir,
    ]);
    if (!extracted.success) {
      throw new Error(`Could not extract release archive: ${extracted.output}`);
    }
    const archiveRoot = archive.replace(/\.tar\.gz$/, "");
    const binaryPath = join(workDir, archiveRoot, "sadoku");
    const binaryInfo = await dependencies.fs.stat(binaryPath).catch(() =>
      undefined
    );
    if (!binaryInfo?.isFile) {
      throw new Error(
        "Release archive does not contain the expected single Sadoku binary.",
      );
    }
    const probe = await dependencies.run(binaryPath, ["--version"]);
    if (!probe.success) {
      throw new Error("Downloaded Sadoku binary could not report its version.");
    }
    const binaryVersion = parseBinaryVersion(probe.output);
    if (binaryVersion !== targetVersion) {
      throw new Error(
        `Downloaded binary version ${binaryVersion} does not match expected version ${targetVersion}.`,
      );
    }

    stagedPath = await dependencies.fs.makeTempFile({
      dir: dirname(executable),
      prefix: ".sadoku-update-",
    }).catch((error) => {
      throw new Error(
        `Sadoku installation directory is not writable: ${
          error instanceof Error ? error.message : error
        }`,
      );
    });
    await dependencies.fs.copyFile(binaryPath, stagedPath);
    await dependencies.fs.chmod(stagedPath, 0o755);
    await dependencies.fs.rename(stagedPath, executable).catch((error) => {
      throw new Error(
        `Could not atomically replace Sadoku; the existing binary was preserved: ${
          error instanceof Error ? error.message : error
        }`,
      );
    });
    stagedPath = undefined;
    return { channel, currentVersion, targetVersion, updated: true };
  } finally {
    if (stagedPath) {
      await dependencies.fs.remove(stagedPath).catch(() => undefined);
    }
    await dependencies.fs.remove(workDir, { recursive: true }).catch(() =>
      undefined
    );
  }
};

export const updateSadoku = async (
  currentVersion: string,
  requestedChannel?: UpdateChannel,
  dependencies: UpdateDependencies = defaultDependencies(),
): Promise<UpdateResult> => {
  const plan = await checkForUpdate(
    currentVersion,
    requestedChannel,
    dependencies,
  );
  return await installUpdate(plan, dependencies);
};

export const updateRepositoryUrl = repository;
