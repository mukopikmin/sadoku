---
name: sadoku-release
description: Propose a semantic version, then prepare and publish Sadoku stable releases with deterministic preflight checks, generated release-note review, explicit approval gates, tag creation, GitHub Actions monitoring, and final artifact verification. Use when asked to prepare, cut, publish, or verify a Sadoku stable release, whether or not a version is specified.
---

# Sadoku Release

Orchestrate the release as a guarded state machine. Use the repository tasks for
machine decisions; do not replace them with ad hoc shell checks. Communicate in
the user's language.

## Safety Rules

- Release only the exact tested commit on `main` that matches `origin/main`.
- Never delete, stash, commit, or overwrite user changes to obtain a clean tree.
- Never force, move, or reuse a release tag that points to another commit.
- Never push a release tag until the user approves the generated notes and SHA.
- Invalidate approval if `HEAD`, `origin/main`, or the generated notes change.
- Never publish from a failed or missing `Test` workflow run.
- Treat `v0.0.0-nightly` as a prerelease, never as the stable notes baseline.
- Do not repair or overwrite a failed published release without new approval.

## Workflow

### 1. Inspect

1. Read repository instructions. Inspect `git status`, worktrees, local and
   remote branches, tags, releases, open pull requests, and the release
   workflows without modifying them.
2. Identify the latest non-draft, non-prerelease stable release. Ignore
   `v0.0.0-nightly`. For the first stable release, use `release-notes-baseline`
   as the comparison point.
3. Review commits and merged pull requests from that comparison point through
   `origin/main`, then propose one unprefixed semantic version:
   - increment major for breaking changes when the current major is at least 1;
   - increment minor for backward-compatible features, and for breaking changes
     while the project is on `0.x`;
   - increment patch when the range contains only fixes, documentation, or
     maintenance changes. Choose the next version for that increment that has no
     existing tag or release. If the range does not justify a release, stop and
     explain why.
4. Present the current stable version, proposed version, increment category,
   rationale, and the principal pull requests or changes in the user's language.
   Ask the user to approve the proposal or provide another version. This is a
   mandatory gate: do not synchronize `main`, run preflight, build artifacts, or
   create a tag until the version is confirmed.
5. If the user supplied a version, still compare it with the changes. Warn about
   a suspected semantic-version mismatch and require explicit confirmation
   before proceeding.
6. Confirm the chosen version is an unprefixed semantic version such as `0.1.0`,
   and derive the tag as `v<version>`.
7. Report any open pull requests that the release will omit.

### 2. Synchronize `main`

1. Stop if tracked or untracked user files would be overwritten.
2. Run `git fetch origin --prune`, switch to `main`, and fast-forward only to
   `origin/main`. Do not use `git fetch --tags`: the rolling nightly tag moves
   and must not be forced over a local tag.
3. Do not merge divergent work. Stop and report the divergence.
4. For the first stable release only, verify `release-notes-baseline` exists at
   the repository root commit. If it is absent, show the root SHA and ask for
   approval before creating and pushing that lightweight non-release tag.
5. Fetch only the fixed baseline or previous stable tag required for note
   generation when it is missing locally. Never fetch the nightly tag with a
   forced refspec.

### 3. Run Preflight

Run:

```sh
deno task release:check --version <version>
```

Require `ok: true` in its JSON result. The task verifies the branch, clean tree,
remote SHA, ahead/behind counts, baseline, release-tag absence, and successful
`Test` workflow for the exact SHA. Do not bypass a failed check.

Run the repository checks required by `.github/workflows/test.yml`. Build
release artifacts with `deno task dist --version <version>` in a clean
environment and verify the native binary before requesting approval.

### 4. Generate and Review Notes

Generate the exact GitHub release-note preview without creating a release:

```sh
deno task release:notes --version <version> --output /tmp/sadoku-release-notes.json
```

Read the JSON and present the target SHA, start tag, title, and body. Confirm
that expected merged pull requests are present, open pull requests are absent,
the changelog is non-empty, and no private or unsuitable text appears.

Stop and ask the user to approve both the displayed notes and exact target SHA.
This is a mandatory gate, not a non-blocking question.

### 5. Revalidate and Tag

After approval:

1. Fetch again without changing the approved commit.
2. Rerun `release:check` and `release:notes`.
3. Compare the SHA, start tag, title, and body with the approved JSON. If any
   field differs, discard approval and return to review.
4. Create an annotated `v<version>` tag on the full approved SHA and show the
   tag before pushing it.
5. Push only that tag without force. Tag push starts the Release workflow.

### 6. Monitor and Verify

1. Monitor the Release workflow for the tagged SHA until it succeeds or fails.
2. On failure, report the failing step and logs. Do not move the tag or replace
   the release automatically.
3. On success, verify the release is stable and latest, its target SHA matches,
   generated notes use the approved start tag, and all three platform archives,
   per-archive SHA-256 files, and `checksums.txt` are attached.
4. Download the published checksums and verify assets where practical.
5. Report the release URL, tag, SHA, notes range, assets, verification results,
   and omitted open pull requests.

## Retry Rules

- Before tag push, rerun safely from Inspect or Preflight.
- If the baseline tag exists at the expected root SHA, reuse it; if it points
  elsewhere, stop.
- If the release tag exists at the approved SHA but no release exists, stop and
  ask whether to retry the workflow. Do not push or recreate it automatically.
- If a GitHub release already exists for the tag, verify and report it instead
  of creating a duplicate.
