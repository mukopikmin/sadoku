# Stable releases

[Back to README](../README.md)

Use the [release skill](../.agents/skills/sadoku-release/SKILL.md) to approve the version, exact
tested `main` commit, notes range, and omitted pull requests. Record the
approved comparison tag in the annotated release tag's `Previous-Stable-Tag`
trailer:

```sh
git tag --annotate v<version> <approved-full-sha> \
  --message "Release v<version>" \
  --message "Previous-Stable-Tag: <approved-comparison-tag>"
```

Pushing that tag starts the Release workflow: validation, the reusable Test
workflow on the tagged commit, builds, attestation, notes, and publication.
The workflow reads the approved baseline from the annotated tag and compares it
with a fresh GitHub lookup. Missing, duplicate, or invalid trailers fail.

For a confirmed first release, use `release-notes-baseline` at the repository
root. An empty stable-release lookup with other stable version tags on the
remote fails instead of implying a first release. Drafts, prereleases, and
nightly releases are excluded from the notes baseline. Validation requires the
current `main` tip and an increasing version. After validation, the source commit
is fixed for testing and building; later `main` updates do not change the release.

Test and build jobs have read-only repository permissions and do not persist
checkout credentials. A separate publish job downloads the build's immutable
artifact by ID, attests the archives for consumers, generates notes, and creates
the release. It does not check out or execute repository code. Before publishing,
the approved baseline must still be the latest stable release, and both tag
objects must be unchanged. This also prevents an old failed run from superseding
a newer release when retried.
Existing releases fail creation; no assets are overwritten. Failed runs leave
tags intact; never move or recreate a stable tag. Repository rules should restrict
stable tag creation and prevent updates or deletion, including the comparison
baseline. Tag rules enforce who can start publication: a tag push loads its
workflow from the tagged revision, so workflow checks alone cannot police a
tag creator who can replace that workflow.
