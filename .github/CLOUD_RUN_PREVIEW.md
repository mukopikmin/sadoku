# Cloud Run pull request previews

The `cloud_run_preview.yml` workflow expects these GitHub repository or
`cloud-run-preview` environment variables:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `CLOUD_RUN_SERVICE`
- `ARTIFACT_REGISTRY_REPOSITORY`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`

No service-account key is stored in GitHub. The workflow exchanges GitHub's OIDC
token through Workload Identity Federation. Project IDs, resource names, and
service account email addresses are identifiers rather than credentials, so they
are configuration variables and are not masked. Store any future passwords,
keys, or tokens as GitHub secrets instead.

The workflow builds pull request code in a separate job that has no
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
assertion.event_name == 'pull_request'
```

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
