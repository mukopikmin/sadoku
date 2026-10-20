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

After a successful deployment and revision readiness check, the workflow posts
its preview URL, deployed commit, and workflow run link in a pull request
comment. Subsequent deployments update the same `github-actions[bot]` comment.
Main deployments publish their URL in the deployment environment and workflow
summary without posting a pull request comment.

Preview links use the proxy's configured `PUBLIC_ORIGIN` and the route
`/revisions/<tag>/`, including the trailing slash. The workflow reads this
origin from the proxy Cloud Run service named by `CLOUD_RUN_PROXY_SERVICE`, in
the same project as the backend and the region selected by
`CLOUD_RUN_PROXY_REGION` (or `GCP_REGION` when unset). The workflow uses the
proxy URL for comments, deployment environment links, and its summary. It
queries the backend Cloud Run API only to verify the tag and revision readiness.

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

Set `CLOUD_RUN_PROXY_SERVICE` as a GitHub Actions **variable**, not a secret.
Use a repository variable so both the preview and proxy deployment workflows can
read it: **Settings → Secrets and variables → Actions → Variables → New
repository variable**. Its value is the existing proxy Cloud Run service's short
name (for example, `sadoku-revision-proxy`), not the backend service name, a
URL, a custom domain, or a full resource path. The service must be in the same
project as the backend. When its region differs, set the repository Actions
variable `CLOUD_RUN_PROXY_REGION` to the proxy's actual region (for example,
`asia-northeast2`). Both workflows use this region for proxy operations and fall
back to their existing `GCP_REGION` secret when it is unset. Backend deployment
and readiness checks continue to use `GCP_REGION`.

Alternatively, define the variable separately in both `cloud-run-preview` and
`cloud-run-proxy` environments. An environment variable overrides a repository
variable with the same name. Both workflows read `vars.CLOUD_RUN_PROXY_SERVICE`
and do not fall back to a secret. The proxy's existing `PUBLIC_ORIGIN` supplies
the mapped custom domain; no additional domain variable is required.

No service-account key is stored in GitHub. The workflow exchanges GitHub's OIDC
token through Workload Identity Federation. The remaining project IDs, resource
names, and service account email addresses listed above are identifiers rather
than credentials, but keep them as GitHub secrets so GitHub Actions masks their
values in public workflow logs. Store any future passwords, keys, or tokens as
GitHub secrets too.

If the secret values listed above were previously stored as configuration
variables, register them as secrets with the same names and remove the old
variables. Those secrets do not fall back to variables. Masking does not remove
values from earlier workflow logs or guarantee that transformed or partial
values are hidden. The preview URL is still published as the deployment
environment URL and may reveal resource identifiers; log masking is not access
control for that endpoint.

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
- `roles/run.developer` on the one preview Cloud Run service;
- `run.services.get` on the proxy Cloud Run service to read its `PUBLIC_ORIGIN`
  (for example, a custom role containing only this permission); and
- `roles/iam.serviceAccountUser` on the dedicated Cloud Run runtime service
  account.

Treat the preview image as untrusted even after the credential-free build. Give
the dedicated runtime service account no Google Cloud roles unless the preview
has a documented need for one, and then grant only that narrowly scoped role.

Do not grant the deployment identity Owner, Editor, service-account-key
creation, or broad service-account impersonation roles. The Cloud Run service
should use a dedicated runtime service account rather than the deployment
service account.
