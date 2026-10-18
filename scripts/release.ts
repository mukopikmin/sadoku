export const BASELINE_TAG = "release-notes-baseline";

const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const stableTag = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export type ReleaseArguments = {
  command: "check" | "notes";
  version: string;
  output?: string;
};

type CommandResult = {
  success: boolean;
  stdout: string;
  stderr: string;
};

export type ReleaseRunner = (
  command: string,
  args: string[],
) => Promise<CommandResult>;

type Check = {
  name: string;
  ok: boolean;
  actual: string;
  expected: string;
};

type Release = {
  tagName: string;
  isDraft: boolean;
  isPrerelease: boolean;
};

const decoder = new TextDecoder();

export const parseArguments = (args: string[]): ReleaseArguments => {
  const command = args[0];
  if (command !== "check" && command !== "notes") {
    throw new Error("Expected command 'check' or 'notes'.");
  }

  const versionIndex = args.indexOf("--version");
  const version = versionIndex === -1 ? undefined : args[versionIndex + 1];
  if (!version) throw new Error("Missing --version <version>.");
  if (!stableVersion.test(version)) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  const outputIndex = args.indexOf("--output");
  const output = outputIndex === -1 ? undefined : args[outputIndex + 1];
  if (outputIndex !== -1 && !output) throw new Error("Missing --output value.");
  if (command === "notes" && !output) {
    throw new Error("The notes command requires --output <path>.");
  }

  return { command, version, output };
};

const run: ReleaseRunner = async (command, args) => {
  try {
    const result = await new Deno.Command(command, {
      args,
      stdout: "piped",
      stderr: "piped",
    }).output();
    return {
      success: result.success,
      stdout: decoder.decode(result.stdout).trim(),
      stderr: decoder.decode(result.stderr).trim(),
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return { success: false, stdout: "", stderr: `${command} was not found` };
    }
    throw error;
  }
};

export const selectPreviousStableTag = (releases: Release[]): string =>
  releases.find((release) =>
    !release.isDraft && !release.isPrerelease && stableTag.test(release.tagName)
  )?.tagName ?? BASELINE_TAG;

const requireResult = (result: CommandResult, description: string): string => {
  if (!result.success) {
    throw new Error(`${description}: ${result.stderr || "command failed"}`);
  }
  return result.stdout;
};

const releaseContext = async (execute: ReleaseRunner) => {
  const headSha = requireResult(
    await execute("git", ["rev-parse", "HEAD"]),
    "Read HEAD",
  );
  const repository = requireResult(
    await execute("gh", [
      "repo",
      "view",
      "--json",
      "nameWithOwner",
      "--jq",
      ".nameWithOwner",
    ]),
    "Resolve GitHub repository",
  );
  // Include drafts and every page so API failures cannot masquerade as absence.
  const releasesOutput = requireResult(
    await execute("gh", [
      "api",
      "--paginate",
      `repos/${repository}/releases?per_page=100`,
      "--jq",
      ".[] | {tagName: .tag_name, isDraft: .draft, isPrerelease: .prerelease}",
    ]),
    "List GitHub releases",
  );
  const releases: Release[] = releasesOutput
    ? releasesOutput.split("\n").map((line) => JSON.parse(line))
    : [];
  return {
    headSha,
    repository,
    releases,
    previousStableTag: selectPreviousStableTag(releases),
  };
};

const isNewerVersion = (version: string, previousTag: string): boolean => {
  if (previousTag === BASELINE_TAG) return true;
  const previous = previousTag.slice(1).split(".").map(BigInt);
  const next = version.split(".").map(BigInt);
  for (let index = 0; index < next.length; index++) {
    if (next[index] !== previous[index]) return next[index] > previous[index];
  }
  return false;
};

export const inspectRelease = async (
  version: string,
  execute: ReleaseRunner = run,
) => {
  // Also validate callers that do not enter through the CLI argument parser.
  parseArguments(["check", "--version", version]);
  const tag = `v${version}`;
  const context = await releaseContext(execute);
  const git = (...args: string[]) => execute("git", args);
  requireResult(
    await git("fetch", "--no-tags", "origin", "main"),
    "Fetch main",
  );
  const remoteMain = requireResult(
    await git("rev-parse", "origin/main"),
    "Read origin/main",
  );
  const tagRef = `refs/tags/${tag}`;
  const tagObject = requireResult(
    await git("rev-parse", "--verify", tagRef),
    "Read release tag",
  );
  const tagCommit = requireResult(
    await git("rev-parse", "--verify", `${tagRef}^{commit}`),
    "Resolve release tag commit",
  );
  const remoteTag = requireResult(
    await git("ls-remote", "--exit-code", "--tags", "origin", tagRef),
    "Read remote release tag",
  );
  const remoteTagObject = remoteTag.split("\n").find((line) =>
    line.split(/\s+/)[1] === tagRef
  )?.split(/\s+/)[0];
  const previousCommit = requireResult(
    await git(
      "rev-parse",
      "--verify",
      `refs/tags/${context.previousStableTag}^{commit}`,
    ),
    "Read notes start tag",
  );
  const ancestor = await git(
    "merge-base",
    "--is-ancestor",
    previousCommit,
    context.headSha,
  );
  const root = context.previousStableTag === BASELINE_TAG
    ? requireResult(
      await git("rev-list", "--max-parents=0", "HEAD"),
      "Read repository root",
    )
    : undefined;
  const ciOutput = requireResult(
    await execute("gh", [
      "run",
      "list",
      "--repo",
      context.repository,
      "--workflow",
      "test.yml",
      "--branch",
      "main",
      "--event",
      "push",
      "--commit",
      context.headSha,
      "--limit",
      "1",
      "--json",
      "conclusion,headSha,url",
    ]),
    "Read Test run",
  );
  const ciRuns = JSON.parse(ciOutput) as Array<{
    conclusion: string;
    headSha: string;
    url: string;
  }>;
  const successfulRun = ciRuns.find((run) =>
    run.conclusion === "success" && run.headSha === context.headSha
  );
  const checks: Check[] = [
    {
      name: "remoteMain",
      ok: context.headSha === remoteMain,
      actual: context.headSha,
      expected: remoteMain,
    },
    {
      name: "releaseTag",
      ok: tagCommit === context.headSha && remoteTagObject === tagObject,
      actual:
        `${tagCommit} / ${tagObject} locally / ${remoteTagObject} on origin`,
      expected: `unchanged ${tag} at ${context.headSha}`,
    },
    {
      name: "releaseAbsent",
      ok: !context.releases.some((release) => release.tagName === tag),
      actual: context.releases.some((release) => release.tagName === tag)
        ? "already exists"
        : "absent",
      expected: "absent, including drafts",
    },
    {
      name: "notesBaseline",
      ok: ancestor.success && previousCommit !== context.headSha &&
        (root === undefined || root === previousCommit),
      actual: `${context.previousStableTag} at ${previousCommit}`,
      expected: "an earlier ancestor; the root commit for the first release",
    },
    {
      name: "newerVersion",
      ok: isNewerVersion(version, context.previousStableTag),
      actual: version,
      expected: `newer than ${context.previousStableTag}`,
    },
    {
      name: "ci",
      ok: Boolean(successfulRun),
      actual: successfulRun?.url ?? "no successful Test push run on main",
      expected: `successful Test run for ${context.headSha}`,
    },
  ];
  return {
    ok: checks.every((check) => check.ok),
    version,
    tag,
    tagObject,
    headSha: context.headSha,
    previousStableTag: context.previousStableTag,
    checks,
  };
};

export const generateNotes = async (
  version: string,
  output: string,
  execute: ReleaseRunner = run,
): Promise<void> => {
  const tag = `v${version}`;
  const context = await releaseContext(execute);
  requireResult(
    await execute("git", [
      "rev-parse",
      "--verify",
      `refs/tags/${context.previousStableTag}^{commit}`,
    ]),
    `Verify notes start tag ${context.previousStableTag}`,
  );
  const notes = await execute("gh", [
    "api",
    "--method",
    "POST",
    `repos/${context.repository}/releases/generate-notes`,
    "-f",
    `tag_name=${tag}`,
    "-f",
    `target_commitish=${context.headSha}`,
    "-f",
    `previous_tag_name=${context.previousStableTag}`,
  ]);
  const parsed = JSON.parse(requireResult(notes, "Generate release notes")) as {
    name?: string;
    body?: string;
  };
  if (!parsed.body?.trim()) {
    throw new Error("Generated release notes are empty.");
  }
  const result = {
    version,
    tag,
    headSha: context.headSha,
    previousStableTag: context.previousStableTag,
    title: parsed.name || tag,
    body: parsed.body,
  };
  await Deno.writeTextFile(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, output, ...result }, null, 2));
};

if (import.meta.main) {
  try {
    const args = parseArguments(Deno.args);
    if (args.command === "check") {
      const result = await inspectRelease(args.version);
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) Deno.exit(1);
    } else {
      await generateNotes(args.version, args.output!);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}
