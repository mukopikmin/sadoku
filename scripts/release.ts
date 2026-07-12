export const BASELINE_TAG = "release-notes-baseline";

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

type Check = {
  name: string;
  ok: boolean;
  actual: string;
  expected: string;
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
  if (
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)
  ) {
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

const run = async (command: string, args: string[]): Promise<CommandResult> => {
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

export const selectPreviousStableTag = (
  releases: Array<{ tagName: string; isDraft: boolean; isPrerelease: boolean }>,
): string =>
  releases.find((release) => !release.isDraft && !release.isPrerelease)
    ?.tagName ?? BASELINE_TAG;

const git = (...args: string[]) => run("git", args);
const gh = (...args: string[]) => run("gh", args);

const requireResult = (result: CommandResult, description: string): string => {
  if (!result.success) {
    throw new Error(`${description}: ${result.stderr || "command failed"}`);
  }
  return result.stdout;
};

const releaseContext = async () => {
  const headSha = requireResult(await git("rev-parse", "HEAD"), "Read HEAD");
  const releasesOutput = requireResult(
    await gh(
      "release",
      "list",
      "--exclude-drafts",
      "--exclude-pre-releases",
      "--limit",
      "1",
      "--json",
      "tagName,isDraft,isPrerelease",
    ),
    "List GitHub releases",
  );
  const releases = JSON.parse(releasesOutput) as Array<{
    tagName: string;
    isDraft: boolean;
    isPrerelease: boolean;
  }>;
  const repository = requireResult(
    await gh(
      "repo",
      "view",
      "--json",
      "nameWithOwner",
      "--jq",
      ".nameWithOwner",
    ),
    "Resolve GitHub repository",
  );
  return {
    headSha,
    repository,
    previousStableTag: selectPreviousStableTag(releases),
  };
};

const checkRelease = async (version: string): Promise<void> => {
  const tag = `v${version}`;
  const branch = await git("branch", "--show-current");
  const status = await git("status", "--porcelain");
  const head = await git("rev-parse", "HEAD");
  const remote = await git("rev-parse", "origin/main");
  const divergence = await git(
    "rev-list",
    "--left-right",
    "--count",
    "main...origin/main",
  );
  const rootCommit = await git("rev-list", "--max-parents=0", "HEAD");
  const baseline = await git(
    "rev-parse",
    "--verify",
    `refs/tags/${BASELINE_TAG}^{commit}`,
  );
  const remoteBaseline = await git(
    "ls-remote",
    "--exit-code",
    "--tags",
    "origin",
    `refs/tags/${BASELINE_TAG}`,
  );
  const releaseTag = await git("rev-parse", "--verify", `refs/tags/${tag}`);
  const remoteReleaseTag = await git(
    "ls-remote",
    "--exit-code",
    "--tags",
    "origin",
    `refs/tags/${tag}`,
  );
  const ci = await gh(
    "run",
    "list",
    "--workflow",
    "Test",
    "--branch",
    "main",
    "--commit",
    head.stdout,
    "--limit",
    "1",
    "--json",
    "conclusion,headSha,url",
  );
  const ciRuns = ci.success
    ? JSON.parse(ci.stdout) as Array<
      { conclusion: string; headSha: string; url: string }
    >
    : [];
  const successfulRun = ciRuns.find((run) =>
    run.conclusion === "success" && run.headSha === head.stdout
  );
  const remoteBaselineSha = remoteBaseline.stdout.split(/\s+/)[0] ?? "";

  const checks: Check[] = [
    {
      name: "branch",
      ok: branch.success && branch.stdout === "main",
      actual: branch.stdout,
      expected: "main",
    },
    {
      name: "cleanTree",
      ok: status.success && status.stdout === "",
      actual: status.stdout || "clean",
      expected: "clean",
    },
    {
      name: "remoteMain",
      ok: head.success && remote.success && head.stdout === remote.stdout,
      actual: `${head.stdout} / ${remote.stdout}`,
      expected: "matching SHAs",
    },
    {
      name: "divergence",
      ok: divergence.success && divergence.stdout === "0\t0",
      actual: divergence.stdout,
      expected: "0\\t0",
    },
    {
      name: "baselineTag",
      ok: baseline.success && remoteBaseline.success && rootCommit.success &&
        baseline.stdout === rootCommit.stdout &&
        remoteBaselineSha === rootCommit.stdout,
      actual: baseline.success && remoteBaseline.success
        ? `${baseline.stdout} locally / ${remoteBaselineSha} on origin`
        : "missing locally or on origin",
      expected:
        `${BASELINE_TAG} at root ${rootCommit.stdout} locally and on origin`,
    },
    {
      name: "releaseTagAbsent",
      ok: !releaseTag.success && !remoteReleaseTag.success,
      actual: releaseTag.success || remoteReleaseTag.success
        ? releaseTag.stdout || remoteReleaseTag.stdout
        : "absent",
      expected: "absent locally and on origin",
    },
    {
      name: "ci",
      ok: Boolean(successfulRun),
      actual: successfulRun?.url ?? (ci.stderr || "no successful run"),
      expected: `successful Test run for ${head.stdout}`,
    },
  ];
  const result = {
    ok: checks.every((check) => check.ok),
    version,
    tag,
    headSha: head.stdout,
    checks,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) Deno.exit(1);
};

const generateNotes = async (
  version: string,
  output: string,
): Promise<void> => {
  const tag = `v${version}`;
  const context = await releaseContext();
  const baseline = await git(
    "rev-parse",
    "--verify",
    `refs/tags/${context.previousStableTag}`,
  );
  requireResult(
    baseline,
    `Verify notes start tag ${context.previousStableTag}`,
  );

  const notes = await gh(
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
  );
  const parsed = JSON.parse(requireResult(notes, "Generate release notes")) as {
    name?: string;
    body?: string;
  };
  const result = {
    version,
    tag,
    headSha: context.headSha,
    previousStableTag: context.previousStableTag,
    title: parsed.name ?? tag,
    body: parsed.body ?? "",
  };
  await Deno.writeTextFile(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, output, ...result }, null, 2));
};

if (import.meta.main) {
  try {
    const args = parseArguments(Deno.args);
    if (args.command === "check") await checkRelease(args.version);
    else await generateNotes(args.version, args.output!);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}
