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
token through Workload Identity Federation.

## Google Cloud setup

Restrict the Workload Identity Provider to this repository. In addition to an
attribute mapping containing `attribute.repository=assertion.repository`,
configure this attribute condition (replace the example value):

```text
assertion.repository == 'OWNER/REPOSITORY'
```

Grant the deployment service account only these roles, scoped as narrowly as
Google Cloud IAM permits:

- `roles/artifactregistry.writer` on the one Artifact Registry repository;
- `roles/run.developer` on the one preview Cloud Run service; and
- `roles/iam.serviceAccountUser` on the dedicated Cloud Run runtime service
  account.

Do not grant the deployment identity Owner, Editor, service-account-key
creation, or broad service-account impersonation roles. The Cloud Run service
should use a dedicated runtime service account rather than the deployment
service account.
