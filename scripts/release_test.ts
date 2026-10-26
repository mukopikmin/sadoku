import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  BASELINE_TAG,
  generateNotes,
  inspectRelease,
  parseArguments,
  readApprovedBaseline,
  type ReleaseRunner,
  selectPreviousStableTag,
} from "./release.ts";

Deno.test("parses release check arguments", () => {
  assertEquals(parseArguments(["check", "--version", "0.1.0"]), {
    command: "check",
    version: "0.1.0",
    output: undefined,
  });
});

Deno.test("requires notes output path", () => {
  assertThrows(
    () => parseArguments(["notes", "--version", "0.1.0"]),
    Error,
    "requires --output",
  );
});

Deno.test("rejects invalid release versions", () => {
  for (const version of ["v0.1.0", "01.0.0", "0.01.0", "0.1.00"]) {
    assertThrows(
      () => parseArguments(["check", "--version", version]),
      Error,
      "Invalid semantic version",
    );
  }
});

Deno.test("rejects prerelease and build metadata for stable releases", () => {
  for (const version of ["0.1.0-rc.1", "0.1.0+build.1"]) {
    assertThrows(
      () => parseArguments(["check", "--version", version]),
      Error,
      "Invalid semantic version",
    );
  }
});

Deno.test("selects the newest non-draft stable release", () => {
  assertEquals(
    selectPreviousStableTag([
      { tagName: "nightly", isDraft: false, isPrerelease: false },
      { tagName: "v0.0.0-nightly", isDraft: false, isPrerelease: false },
      { tagName: "v0.2.0-nightly", isDraft: false, isPrerelease: true },
      { tagName: "v0.2.0", isDraft: false, isPrerelease: false },
      { tagName: "v0.3.0", isDraft: true, isPrerelease: false },
      { tagName: "v0.1.0", isDraft: false, isPrerelease: false },
    ]),
    "v0.2.0",
  );
});

const head = "a".repeat(40);
const previous = "b".repeat(40);
const tagObject = "c".repeat(40);

type Scenario = {
  main?: string;
  tagCommit?: string;
  remoteTagObject?: string;
  previousTag?: string;
  previousCommit?: string;
  root?: string;
  ancestor?: boolean;
  ci?: Array<Record<string, string | number>>;
  approvedTag?: string;
  tagInfo?: string;
  releaseOutput?: string;
  remoteStableTags?: string;
  existingRelease?: { draft: boolean; prerelease: boolean };
  notes?: { name?: string; body?: string };
  fail?: "releases" | "fetch" | "remoteTag" | "ci" | "stableTags" | "tagInfo";
};

const releaseRunner = (scenario: Scenario = {}): ReleaseRunner => {
  const previousTag = scenario.previousTag ?? "v0.9.0";
  const responses: Record<string, string | boolean> = {
    "rev-parse HEAD": head,
    "for-each-ref --format=%(objecttype)%0a%(contents:trailers:key=Previous-Stable-Tag,valueonly) refs/tags/v0.10.0":
      scenario.fail === "tagInfo"
        ? false
        : scenario.tagInfo ?? `tag\n${scenario.approvedTag ?? previousTag}`,
    "ls-remote --tags origin refs/tags/v*": scenario.fail === "stableTags"
      ? false
      : scenario.remoteStableTags ??
        (previousTag === BASELINE_TAG
          ? ""
          : `${previous}\trefs/tags/${previousTag}`),
    "fetch --no-tags origin main": scenario.fail !== "fetch",
    "rev-parse origin/main": scenario.main ?? head,
    "rev-parse --verify refs/tags/v0.10.0": tagObject,
    "rev-parse --verify refs/tags/v0.10.0^{commit}": scenario.tagCommit ?? head,
    "ls-remote --exit-code --tags origin refs/tags/v0.10.0":
      scenario.fail === "remoteTag"
        ? false
        : `${scenario.remoteTagObject ?? tagObject}\trefs/tags/v0.10.0`,
    [`rev-parse --verify refs/tags/${previousTag}^{commit}`]:
      scenario.previousCommit ?? previous,
    [`merge-base --is-ancestor ${scenario.previousCommit ?? previous} ${head}`]:
      scenario.ancestor ?? true,
    "rev-list --max-parents=0 HEAD": scenario.root ?? previous,
  };
  return (command, args) => {
    let response: string | boolean | undefined;
    if (command === "git") response = responses[args.join(" ")];
    else if (command === "gh" && args[0] === "repo") {
      response = "owner/sadoku";
    } else if (command === "gh" && args.includes("POST")) {
      response = JSON.stringify(
        scenario.notes ?? {
          name: "v0.10.0",
          body: "Changes since v0.9.0",
        },
      );
    } else if (command === "gh" && args[0] === "api") {
      const releases = previousTag === BASELINE_TAG ? [] : [{
        tag_name: previousTag,
        draft: false,
        prerelease: false,
      }];
      if (scenario.existingRelease) {
        releases.push({ tag_name: "v0.10.0", ...scenario.existingRelease });
      }
      response = scenario.fail === "releases"
        ? false
        : scenario.releaseOutput ?? releases.map((release) =>
          JSON.stringify({
            tagName: release.tag_name,
            isDraft: release.draft,
            isPrerelease: release.prerelease,
          })
        ).join("\n");
    } else if (command === "gh" && args[0] === "run") {
      response = scenario.fail === "ci" ? false : JSON.stringify(
        (scenario.ci ?? [{
          conclusion: "success",
          headSha: head,
          url: "https://example.test/run",
        }]).map((run) => ({
          databaseId: 1,
          workflowName: "Test",
          headBranch: "main",
          event: "push",
          status: "completed",
          ...run,
        })),
      );
    }
    if (response === undefined) {
      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    }
    return Promise.resolve({
      success: response !== false,
      stdout: typeof response === "string" ? response : "",
      stderr: response === false ? "command failed" : "",
    });
  };
};

Deno.test("validates an existing tag on tested main without a local branch or clean tree", async () => {
  const result = await inspectRelease("0.10.0", releaseRunner());
  assertEquals(result.ok, true);
  assertEquals(result.headSha, head);
  assertEquals(result.previousStableTag, "v0.9.0");
});

Deno.test("rejects stale main, changed tags, existing releases, and invalid notes ranges", async () => {
  const scenarios: Array<[Scenario, string]> = [
    [{ main: previous }, "remoteMain"],
    [{ tagCommit: previous }, "releaseTag"],
    [{ remoteTagObject: previous }, "releaseTag"],
    [{ existingRelease: { draft: false, prerelease: false } }, "releaseAbsent"],
    [{ existingRelease: { draft: true, prerelease: false } }, "releaseAbsent"],
    [{ ancestor: false }, "notesBaseline"],
    [{ previousCommit: head }, "notesBaseline"],
    [{ previousTag: "v0.11.0" }, "newerVersion"],
  ];
  for (const [scenario, failedCheck] of scenarios) {
    const result = await inspectRelease("0.10.0", releaseRunner(scenario));
    assertEquals(result.ok, false);
    assertEquals(
      result.checks.find((check) => check.name === failedCheck)?.ok,
      false,
    );
  }
});

Deno.test("checks the root baseline only for the first stable release", async () => {
  const first = { previousTag: BASELINE_TAG };
  assertEquals((await inspectRelease("0.10.0", releaseRunner(first))).ok, true);
  const invalid = await inspectRelease(
    "0.10.0",
    releaseRunner({
      ...first,
      root: head,
    }),
  );
  assertEquals(invalid.ok, false);
  assertEquals(
    invalid.checks.find((check) => check.name === "notesBaseline")?.ok,
    false,
  );
});

Deno.test("fails closed on GitHub and Git lookup failures", async () => {
  for (
    const fail of [
      "releases",
      "fetch",
      "remoteTag",
      "ci",
      "stableTags",
      "tagInfo",
    ] as const
  ) {
    await assertRejects(
      () => inspectRelease("0.10.0", releaseRunner({ fail })),
      Error,
      "command failed",
    );
  }
});

Deno.test("generates notes for the tagged commit and previous stable release", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const output = `${directory}/notes.json`;
    const execute = releaseRunner();
    await generateNotes("0.10.0", output, (command, args) => {
      if (command === "gh" && args.includes("POST")) {
        assertEquals(args.includes("tag_name=v0.10.0"), true);
        assertEquals(args.includes(`target_commitish=${head}`), true);
        assertEquals(args.includes("previous_tag_name=v0.9.0"), true);
      }
      return execute(command, args);
    });
    assertEquals(JSON.parse(await Deno.readTextFile(output)), {
      version: "0.10.0",
      tag: "v0.10.0",
      headSha: head,
      previousStableTag: "v0.9.0",
      title: "v0.10.0",
      body: "Changes since v0.9.0",
    });
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("rejects missing or blank generated notes", async () => {
  const directory = await Deno.makeTempDir();
  try {
    for (const notes of [{}, { body: "" }, { body: " \n" }]) {
      await assertRejects(
        () =>
          generateNotes(
            "0.10.0",
            `${directory}/notes.json`,
            releaseRunner({ notes }),
          ),
        Error,
        "Generated release notes are empty",
      );
    }
    assertEquals(Array.from(Deno.readDirSync(directory)).length, 0);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("falls back to the release notes baseline", () => {
  assertEquals(
    selectPreviousStableTag([
      { tagName: "v0.1.0-nightly", isDraft: false, isPrerelease: true },
    ]),
    BASELINE_TAG,
  );
});

Deno.test("requires one approved baseline in an annotated tag", () => {
  for (
    const invalid of [
      "",
      "commit\nv0.9.0",
      "tag",
      "tag\nv0.9.0\nv0.9.0",
      "tag\nv0.9.0\nv1.0.0",
      "tag\nv01.0.0",
      "tag\nnightly",
      "tag\nv0.9.0-nightly",
    ]
  ) {
    assertThrows(
      () => readApprovedBaseline(invalid),
      Error,
      "Previous-Stable-Tag",
    );
  }
  for (const tag of ["v0.9.0", BASELINE_TAG]) {
    assertEquals(readApprovedBaseline(`tag\n${tag}\n`), tag);
  }
});

Deno.test("rejects inconsistent baseline lookups before writing notes", async () => {
  const cases: Array<[Scenario, string]> = [
    [{ releaseOutput: "" }, "stable tags exist"],
    [{ releaseOutput: "", approvedTag: BASELINE_TAG }, "stable tags exist"],
    [{ approvedTag: "v0.8.0" }, "differs from the approved"],
    [{ releaseOutput: "", remoteStableTags: "" }, "differs from the approved"],
  ];
  const directory = await Deno.makeTempDir();
  try {
    for (const [scenario, message] of cases) {
      const error = await assertRejects(
        () => inspectRelease("0.10.0", releaseRunner(scenario)),
        Error,
        message,
      );
      assertEquals(error.message.includes('"releases":'), true);
      assertEquals(
        error.message.includes('"approvedPreviousStableTag":'),
        true,
      );
      await assertRejects(
        () =>
          generateNotes(
            "0.10.0",
            `${directory}/notes.json`,
            releaseRunner(scenario),
          ),
        Error,
        message,
      );
    }
    assertEquals(Array.from(Deno.readDirSync(directory)).length, 0);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

for (
  const { name, ci } of [
    { name: "no runs", ci: [] },
    {
      name: "blank conclusion",
      ci: [{ conclusion: "", headSha: head, url: "pending" }],
    },
    ...Object.entries({
      databaseId: 0,
      workflowName: "Other",
      headBranch: "v0.10.0",
      event: "pull_request",
      status: "in_progress",
      conclusion: "failure",
      headSha: previous,
      url: "",
    }).map(([field, value]) => ({
      name: field,
      ci: [{
        conclusion: "success",
        headSha: head,
        url: "https://example.test/run",
        [field]: value,
      }],
    })),
  ]
) {
  Deno.test(`rejects invalid release CI (${name}) and reports returned runs`, async () => {
    const result = await inspectRelease(
      "0.10.0",
      releaseRunner({ ci }),
    );
    assertEquals(result.ok, false);
    assertEquals(result.ciRuns.length, ci.length);
    const check = result.checks.find((check) => check.name === "ci");
    assertEquals(check?.ok, false);
    assertEquals(
      check?.actual.includes("returned runs:"),
      true,
    );
  });
}
