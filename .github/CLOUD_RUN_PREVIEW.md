# Cloud Run previews

Pull requests authored by `dependabot[bot]` skip all preview jobs, including
image builds, deployments, and tag cleanup, even when a person reruns the
workflow.

The `cloud_run_preview.yml` workflow deploys same-repository pull requests with
a `pr-<number>` revision tag and every push to `main`, including merged pull
requests, with a stable `main` revision tag. Main deployments build the pushed
commit, including the merge result. Closing a pull request removes only its PR
tag; the `main` tag remains available. Each PR and `main` have separate
concurrency groups so their runs do not cancel each other.

Both types of deployment use `--no-traffic` and publish their tagged preview URL
in the workflow summary and the `cloud-run-preview` deployment environment.
Existing service traffic is preserved.

The preview image includes the selected commit's repository contents under
`/app`, subject to `.dockerignore`. Sadoku opens
`/app/test/integration/fixtures` as a directory so the preview lists the
integration test's Markdown fixtures. Set `SADOKU_SOURCE` to override the
source; for example, `/app/README.md` opens only the README.

The `cloud_run_preview.yml` workflow expects these GitHub repository or
`cloud-run-preview` environment secrets:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `CLOUD_RUN_SERVICE`
- `ARTIFACT_REGISTRY_REPOSITORY`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`

No service-account key is stored in GitHub. The workflow exchanges GitHub's OIDC
token through Workload Identity Federation. Project IDs, resource names, and
service account email addresses are identifiers rather than credentials, but
store them as GitHub secrets so that GitHub Actions masks their values in public
workflow logs. Store any future passwords, keys, or tokens as GitHub secrets
too.

If these values were previously stored as configuration variables, register them
as secrets with the same names and remove the old variables. The workflow does
not fall back to variables. Masking does not remove values from earlier workflow
logs or guarantee that transformed or partial values are hidden. The preview URL
is still published as the deployment environment URL and may reveal resource
identifiers; log masking is not access control for that endpoint.

The workflow builds the selected commit in a separate job that has no
`id-token: write` permission and no Google Cloud credentials. Only the saved
image artifact crosses into the deployment job, and it is loaded before OIDC
authentication. The deployment job does not check out or execute pull request
scripts after authentication. Temporary `gha-creds-*.json` files are also
excluded from Git and Docker build contexts as defense in depth.

## Google Cloud setup

Restrict the Workload Identity Provider to this repository. In addition to an
attribute mapping containing the following entries:

```text
google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.event_name=assertion.event_name
```

Configure this attribute condition, replacing both example values. The numeric
repository ID remains stable if the repository is renamed:

```text
assertion.repository == 'OWNER/REPOSITORY' &&
assertion.repository_id == 'REPOSITORY_ID' &&
(assertion.event_name == 'pull_request' ||
 (assertion.event_name == 'push' && assertion.ref == 'refs/heads/main'))
```

If the provider currently permits only `pull_request` events, update its
attribute condition before the first main deployment. The GitHub Environment's
deployment branch rules must also permit `main` in addition to pull request
refs. Required reviewers, if configured, still need to approve each deployment.

Apply the same repository restriction to the service account's
`roles/iam.workloadIdentityUser` binding. Configure required reviewers on the
`cloud-run-preview` GitHub Environment so that a compromised account with branch
write access cannot obtain deployment credentials without approval.

Grant the deployment service account only these roles, scoped as narrowly as
Google Cloud IAM permits:

- `roles/artifactregistry.writer` on the one Artifact Registry repository;
- `roles/run.developer` on the one preview Cloud Run service; and
- `roles/iam.serviceAccountUser` on the dedicated Cloud Run runtime service
  account.

Treat the preview image as untrusted even after the credential-free build. Give
the dedicated runtime service account no Google Cloud roles unless the preview
has a documented need for one, and then grant only that narrowly scoped role.

Do not grant the deployment identity Owner, Editor, service-account-key
creation, or broad service-account impersonation roles. The Cloud Run service
should use a dedicated runtime service account rather than the deployment
service account.
