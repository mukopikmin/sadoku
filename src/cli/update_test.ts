import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
  archiveName,
  defaultUpdateChannel,
  type UpdateDependencies,
  updateSadoku,
  verifyChecksum,
} from "./update.ts";

const hexDigest = async (bytes: Uint8Array): Promise<string> =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new Uint8Array(bytes).buffer,
      ),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");

const fixture = async (version: string) => {
  const root = await Deno.makeTempDir();
  const archiveRoot = "sadoku-nightly-linux-x64";
  await Deno.mkdir(join(root, archiveRoot));
  await Deno.writeTextFile(join(root, archiveRoot, "sadoku"), "fixture");
  const archivePath = join(root, `${archiveRoot}.tar.gz`);
  const tar = await new Deno.Command("tar", {
    args: ["-czf", archivePath, "-C", root, archiveRoot],
  }).output();
  if (!tar.success) throw new Error("Could not create test archive");
  const bytes = await Deno.readFile(archivePath);
  return { root, version, bytes, checksum: await hexDigest(bytes) };
};

const dependencies = (
  executable: string,
  archive: Uint8Array,
  checksum: string,
  version: string,
  rename?: UpdateDependencies["fs"]["rename"],
): UpdateDependencies => ({
  execPath: () => executable,
  fetch: (() =>
    Promise.resolve(
      new Response(checksum, { status: 200 }),
    )) as typeof fetch,
  fs: {
    chmod: Deno.chmod,
    copyFile: Deno.copyFile,
    makeTempDir: Deno.makeTempDir,
    makeTempFile: Deno.makeTempFile,
    readFile: Deno.readFile,
    remove: Deno.remove,
    rename: rename ?? Deno.rename,
    stat: Deno.stat,
    writeFile: Deno.writeFile,
  },
  platform: { os: "linux", arch: "x86_64" },
  run: async (command, args) => {
    if (command === "tar") {
      const result = await new Deno.Command(command, { args }).output();
      return { success: result.success, output: "" };
    }
    return { success: true, output: `sadoku ${version}` };
  },
});

const withArchiveFetch = (
  deps: UpdateDependencies,
  archive: Uint8Array,
  checksum: string,
): UpdateDependencies => ({
  ...deps,
  fetch: ((input) =>
    Promise.resolve(
      new Response(
        String(input).endsWith(".sha256")
          ? checksum
          : new Blob([new Uint8Array(archive).buffer]),
      ),
    )) as typeof fetch,
});

Deno.test("selects channels and keeps archive naming aligned with releases", () => {
  assertEquals(defaultUpdateChannel("nightly-20260803-a1b2c3d4"), "nightly");
  assertEquals(defaultUpdateChannel("1.2.3"), "stable");
  assertEquals(defaultUpdateChannel("0.0.0-dev"), "stable");
  assertEquals(
    archiveName("stable", "1.2.3", "linux-x64"),
    "sadoku-v1.2.3-linux-x64.tar.gz",
  );
  assertEquals(
    archiveName("nightly", "nightly", "darwin-arm64"),
    "sadoku-nightly-darwin-arm64.tar.gz",
  );
});

Deno.test("validates SHA-256 checksum syntax and content", async () => {
  const bytes = new TextEncoder().encode("archive");
  await verifyChecksum(bytes, new TextEncoder().encode(await hexDigest(bytes)));
  await assertRejects(
    () => verifyChecksum(bytes, new TextEncoder().encode("bad")),
    Error,
    "64-digit",
  );
  await assertRejects(
    () => verifyChecksum(bytes, new TextEncoder().encode("0".repeat(64))),
    Error,
    "mismatch",
  );
});

Deno.test("downloads, verifies, and atomically replaces a nightly binary", async () => {
  const data = await fixture("nightly-20260803-a1b2c3d4");
  const executable = join(data.root, "installed-sadoku");
  await Deno.writeTextFile(executable, "old");
  let renamed = false;
  let deps = dependencies(
    executable,
    data.bytes,
    data.checksum,
    data.version,
    async (from, to) => {
      renamed = true;
      await Deno.rename(from, to);
    },
  );
  deps = withArchiveFetch(deps, data.bytes, data.checksum);
  try {
    const result = await updateSadoku(
      "nightly-20260802-deadbeef",
      "nightly",
      deps,
    );
    assertEquals(result, {
      channel: "nightly",
      currentVersion: "nightly-20260802-deadbeef",
      targetVersion: data.version,
      updated: true,
    });
    assertEquals(renamed, true);
    assertEquals(await Deno.readTextFile(executable), "fixture");
  } finally {
    await Deno.remove(data.root, { recursive: true });
  }
});

Deno.test("reports no update without replacing the current binary", async () => {
  const data = await fixture("nightly-20260803-a1b2c3d4");
  const executable = join(data.root, "installed-sadoku");
  await Deno.writeTextFile(executable, "old");
  let deps = dependencies(executable, data.bytes, data.checksum, data.version);
  deps = withArchiveFetch(deps, data.bytes, data.checksum);
  try {
    const result = await updateSadoku(data.version, "nightly", deps);
    assertEquals(result.updated, false);
    assertEquals(await Deno.readTextFile(executable), "old");
  } finally {
    await Deno.remove(data.root, { recursive: true });
  }
});

Deno.test("resolves the latest stable release and skips its download when current", async () => {
  const root = await Deno.makeTempDir();
  const executable = join(root, "sadoku");
  await Deno.writeTextFile(executable, "old");
  const requested: string[] = [];
  const deps = dependencies(
    executable,
    new Uint8Array(),
    "0".repeat(64),
    "1.2.3",
  );
  deps.fetch = ((input) => {
    requested.push(String(input));
    return Promise.resolve(
      new Response(JSON.stringify({ tag_name: "v1.2.3" })),
    );
  }) as typeof fetch;
  try {
    const result = await updateSadoku("1.2.3", "stable", deps);
    assertEquals(result.targetVersion, "1.2.3");
    assertEquals(result.updated, false);
    assertEquals(requested.length, 1);
    assertStringIncludes(requested[0], "/releases/latest");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("preserves the existing binary when atomic replacement fails", async () => {
  const data = await fixture("nightly-20260803-a1b2c3d4");
  const executable = join(data.root, "installed-sadoku");
  await Deno.writeTextFile(executable, "old");
  let deps = dependencies(
    executable,
    data.bytes,
    data.checksum,
    data.version,
    () => Promise.reject(new Error("read-only")),
  );
  deps = withArchiveFetch(deps, data.bytes, data.checksum);
  try {
    await assertRejects(
      () => updateSadoku("nightly-20260802-deadbeef", "nightly", deps),
      Error,
      "existing binary was preserved",
    );
    assertEquals(await Deno.readTextFile(executable), "old");
  } finally {
    await Deno.remove(data.root, { recursive: true });
  }
});

Deno.test("rejects source execution explicitly", async () => {
  const deps = dependencies(
    "/usr/bin/deno",
    new Uint8Array(),
    "0".repeat(64),
    "1.0.0",
  );
  await assertRejects(
    () => updateSadoku("0.0.0-dev", undefined, deps),
    Error,
    "run from source",
  );
});
