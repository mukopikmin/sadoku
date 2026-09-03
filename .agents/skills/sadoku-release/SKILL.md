---
name: sadoku-release
description: Propose a semantic version, then orchestrate GitHub Actions that prepare and publish Sadoku stable releases with an explicit approval gate. Use when asked to prepare, cut, publish, or verify a Sadoku stable release, whether or not a version is specified.
---

# Sadoku Release

Orchestrate the release as a guarded state machine. Use the repository tasks for
machine decisions; do not replace them with ad hoc shell checks. Communicate in
the user's language.

## Safety Rules

- Release only the exact tested commit on `main`. Let GitHub Actions make this
  decision; local inspection is advisory.
- Never delete, stash, commit, or overwrite user changes to obtain a clean tree.
- Never force, move, or reuse a release tag that points to another commit.
- Never start the Publish Release workflow until the user approves the generated
  notes, SHA, and release-plan digest produced by Prepare Release.
- Invalidate approval if `HEAD`, `origin/main`, or the generated notes change.
- Never bypass a failed Prepare Release workflow or publish artifacts built
  outside it.
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
   mandatory gate: do not start Prepare Release until the version is confirmed.
5. If the user supplied a version, still compare it with the changes. Warn about
   a suspected semantic-version mismatch and require explicit confirmation
   before proceeding.
6. Confirm the chosen version is an unprefixed semantic version such as `0.1.0`,
   and derive the tag as `v<version>`.
7. Report any open pull requests that the release will omit.

### 2. Select the Target Commit

1. Fetch `origin/main` without modifying the user's working tree and resolve its
   full commit SHA. Do not switch branches, pull, build, or require a clean
   tree.
2. Do not use `git fetch --tags`: the rolling nightly tag moves and must not be
   forced over a local tag.
3. Use the full `origin/main` SHA as the preparation input. GitHub Actions must
   reject it if it no longer matches `main` or lacks a successful `Test` run.
4. For the first stable release only, verify `release-notes-baseline` exists at
   the repository root commit. If it is absent, show the root SHA and ask for
   approval before creating and pushing that lightweight non-release tag.
5. Fetch only the fixed baseline or previous stable tag required for note
   generation when it is missing locally. Never fetch the nightly tag with a
   forced refspec.

### 3. Prepare in GitHub Actions

Start the version-controlled workflow:

```sh
gh workflow run release_prepare.yml \
  -f version=<version> \
  -f target_sha=<full-origin-main-sha>
```

Find the resulting `Prepare Release` run and monitor it until it succeeds or
fails. The workflow, not the agent's machine, verifies the target SHA,
successful `Test` run, tag and release absence, builds and verifies release
artifacts, and generates the release plan. Do not duplicate these decisions or
build release artifacts locally. On failure, report the failing step and logs.

### 4. Review the Prepared Plan

Download the `release-candidate` artifact from the exact preparation run into a
temporary directory. Read `release-plan.json` and `release-notes.md`, calculate
the plan's SHA-256 locally, and require it to match the digest shown in the
workflow summary. Do not edit or repackage the artifact.

```sh
gh run download <prepare-run-id> --name release-candidate --dir <temporary-dir>
```

Present the preparation run URL, target SHA, start tag, title, notes, artifact
names and checksums, and release-plan SHA-256. Confirm that expected merged pull
requests are present, open pull requests are absent, the changelog is non-empty,
and no private or unsuitable text appears. Verify each release archive's build
provenance with `gh attestation verify <archive> --repo <owner/repository>`.

Stop and ask the user to approve the displayed notes, exact target SHA, and plan
SHA-256. This is a mandatory gate, not a non-blocking question.

### 5. Publish the Approved Candidate

After approval:

1. Start `Publish Release` with only the approved preparation run ID and plan
   digest:

   ```sh
   gh workflow run release.yml \
     -f prepare_run_id=<prepare-run-id> \
     -f plan_sha256=<approved-plan-sha256>
   ```

2. Do not create or push a tag locally. The workflow revalidates `main`, the
   latest stable release, tag and release absence, the plan digest, and every
   artifact checksum and provenance attestation before it creates the annotated
   tag and GitHub release.
3. If revalidation fails, discard approval and return to Inspect. Never change
   workflow inputs to bypass a failed invariant.

### 6. Monitor and Verify

1. Monitor the exact Publish Release run until it succeeds or fails.
2. On failure, report the failing step and logs. Do not move the tag or replace
   the release automatically.
3. On success, verify the release is stable and latest, its target SHA matches,
   generated notes use the approved start tag, and all three platform archives,
   per-archive SHA-256 files, and `checksums.txt` are attached.
4. Use the workflow's deterministic verification as the source of truth. Verify
   the published archives' provenance with `gh attestation verify` as an
   additional independent check.
5. Report the release URL, tag, SHA, notes range, assets, verification results,
   and omitted open pull requests.

## Retry Rules

- Before publication, start a new preparation run if the target or release state
  changes. Never reuse approval for another preparation run.
- If the baseline tag exists at the expected root SHA, reuse it; if it points
  elsewhere, stop.
- If the release tag exists at the approved SHA but no release exists, stop and
  report the partial publication. Do not push or recreate it automatically.
- If a GitHub release already exists for the tag, verify and report it instead
  of creating a duplicate.
