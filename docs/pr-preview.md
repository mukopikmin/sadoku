# PR previews

[Back to development](development.md)

## Deployment behavior

The [Preview workflow](../.github/workflows/pr_preview.yml) deploys
same-repository pull requests with a `pr-<number>` revision tag and application
changes pushed to `main` with a stable `main` tag. Main builds use the pushed
commit, including merge results. Closing a PR removes its tag while preserving
`main`. Dependabot PRs skip all preview jobs, including cleanup.

Changes limited to `src/proxy/` or the proxy CI/deployment workflows skip
application CI, preview builds, and nightly application releases. PR closure
still triggers tag cleanup if application changes were reverted. Stable releases
remain explicit. The [proxy deployment workflow](../.github/workflows/cloud_run_proxy.yml)
runs for changes to `src/proxy/` or its deployment workflow on `main`, and can
also be started manually on `main`.

Deployments use `--no-traffic`, preserving existing service traffic. URLs appear
in the workflow summary and `cloud-run-preview` deployment environment. PR
builds create or update one bot comment containing the URL, commit, and run link.
Main deployments do not post PR comments.

Preview URLs use the proxy's `PUBLIC_ORIGIN` and `/revisions/<tag>/` route,
including the trailing slash. The workflow reads the origin from the configured
proxy service and verifies the backend's exact revision and tag readiness.

Runs queue separately for each PR and `main` without canceling in-progress runs.
Deployment and cleanup also share a service-wide concurrency group because they
update the same backend. Both queues retain up to 100 pending entries; ordering
follows when jobs start waiting. Explicit revision suffixes are unique to each
run and attempt, so readiness checks cannot select another deployment's revision.

## Runtime and sample data

The preview image contains the selected repository commit under `/app`, subject
to `.dockerignore`. Runtime uses Alpine, a statically linked Sadoku binary, and
a CA bundle; Node, Go, and compilers stay in build stages. Client assets and the
binary build separately, with dependency downloads before source copies.

Docker runs `scripts/preview_entrypoint.sh` to prepare
[sample data](preview.md), then executes `scripts/cloud_run_entrypoint.sh`.
PR previews disable SSE with `--no-sync` to avoid idle open requests.
Use **Reload preview** to fetch external changes; comment saving still works.
The server stays running without `--keep-alive`.

Set a nonempty `SADOKU_SOURCE`, such as `/app/README.md`, to skip sample
preparation. The configured `SADOKU_COMMENTS_DIR` is preserved; the image defaults
to `/tmp/sadoku-comments`. Instances have independent temporary data, and
restarting or redeploying creates fresh samples. Running the Cloud Run
entrypoint directly skips preparation and uses its own source/storage defaults.

## GitHub configuration

The deployment environment retains the internal name `cloud-run-preview` so
existing secrets and OIDC configuration continue to apply. The workflow and
documentation use PR preview as the feature name.

Configure these repository or `cloud-run-preview` environment **secrets**:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `CLOUD_RUN_SERVICE`
- `ARTIFACT_REGISTRY_REPOSITORY`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`

Configure these repository Actions **variables**:

| Variable | Value |
| --- | --- |
| `CLOUD_RUN_PROXY_SERVICE` | Existing proxy service's short name, such as `sadoku-revision-proxy`; not a URL or backend service name |
| `CLOUD_RUN_PROXY_REGION` | Optional proxy region; defaults to `GCP_REGION` |

The proxy must be in the backend's project. Both preview and proxy deployment
workflows read these variables. Alternatively, define them in both
`cloud-run-preview` and `cloud-run-proxy` environments; environment values
override repository values. The proxy's `PUBLIC_ORIGIN` supplies the custom
domain, so no additional domain variable is needed.

Secrets do not fall back to variables, and proxy variables do not fall back to
secrets. If migrating configuration, register values in the correct location
and remove old entries. Project/resource identifiers are kept as secrets to
mask public logs; passwords, keys, and tokens must also be secrets. Masking does
not hide earlier logs or all transformed values. Published preview URLs can
reveal resource identifiers and are not protected by log masking.

## Google Cloud identity and permissions

Authentication uses GitHub OIDC through Workload Identity Federation; no
service-account key is stored in GitHub. Restrict the provider to this repository
with these attribute mappings:

```text
google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.event_name=assertion.event_name
```

Set this attribute condition, replacing the example values. The numeric ID
remains stable across repository renames:

```text
assertion.repository == 'OWNER/REPOSITORY' &&
assertion.repository_id == 'REPOSITORY_ID' &&
(assertion.event_name == 'pull_request' ||
 (assertion.event_name == 'push' && assertion.ref == 'refs/heads/main'))
```

A provider that previously allowed only PR events must be updated before main
deployments. GitHub Environment deployment branch rules must allow both PR refs
and `main`. Configure required reviewers on `cloud-run-preview` to gate access
to deployment credentials.

Apply the same repository restriction to the service account's
`roles/iam.workloadIdentityUser` binding. Scope deployment permissions narrowly:

- `roles/artifactregistry.writer` on the one Artifact Registry repository.
- `roles/run.developer` on the preview backend service.
- `run.services.get` on the proxy service to read `PUBLIC_ORIGIN`, for example
  through a custom role containing only that permission.
- `roles/iam.serviceAccountUser` on the dedicated runtime service account.

Use a dedicated runtime service account with no Google Cloud roles unless a
specific preview capability requires them. Do not use the deployment identity
as the runtime identity or grant Owner, Editor, service-account-key creation,
or broad impersonation roles.

The image build has no cloud credentials or `id-token: write` permission. Only
the saved image crosses into deployment, and it is loaded before OIDC
authentication. Deployment does not check out or execute PR scripts after
authentication. Treat the image as untrusted even after this isolated build.
Temporary `gha-creds-*.json` files are excluded from Git and Docker contexts.
