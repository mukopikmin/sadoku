# Revision proxy

Separate Cloud Run service: browser → native IAP → Go proxy → backend IAM →
tagged application. TLS uses the front service's `run.app` URL; no load
balancer, domain mapping, session affinity, or per-tag routing is needed.

The application must support `X-Forwarded-Prefix: /revisions/TAG` for links,
assets, API calls, and SSE. Only trust that header behind the authenticated
proxy. Cookie rewriting is not implemented; this setup assumes the application
has no cookies. Response bodies and embedded absolute URLs are not rewritten.

## Configuration

| Environment variable  | Value                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `BACKEND_SERVICE_URL` | Untagged HTTPS origin, verified against actual tagged URLs        |
| `PUBLIC_ORIGIN`       | Front service's browser-facing HTTPS origin                       |
| `IAM_AUDIENCE`        | Backend's untagged service URL; defaults to `BACKEND_SERVICE_URL` |
| `PORT`                | Listening port; default `8080`, supplied by Cloud Run             |
| `LISTEN_HOST`         | Default `127.0.0.1`; image sets `0.0.0.0` for Cloud Run           |

The runtime service account needs `roles/run.invoker` on the backend. Keep
native IAP on the front service, backend IAM authentication enabled, and backend
IAP disabled. Do not grant backend invocation to `allUsers`. No keys or static
token environment variables are used. Backend ingress must allow the proxy's
network path; IAM remains required.

## Development

From the repository root:

```sh
go -C proxy test -race ./...
BACKEND_SERVICE_URL=https://BACKEND.run.app PUBLIC_ORIGIN=https://FRONT.run.app \
  go -C proxy run ./cmd/revision-proxy
docker build --platform linux/amd64 -t revision-proxy proxy
docker run --rm -p 127.0.0.1:8080:8080 \
  -e BACKEND_SERVICE_URL=https://BACKEND.run.app \
  -e PUBLIC_ORIGIN=https://FRONT.run.app revision-proxy
```

Local route checks work using `curl -H 'Host: FRONT.run.app'` against
`http://127.0.0.1:8080/revisions/v1` (308). Forwarding needs Cloud Run metadata
credentials; outside Cloud Run it returns 502. There is no authentication
bypass. Cloud Run can use its default TCP startup probe; `/` intentionally
returns 404.

## Initial setup and manual deployment

First provision a separate front service with native IAP and its runtime service
account, authorize IAP users, and grant that account backend invocation. Record
the front URL as `PUBLIC_ORIGIN`. This command updates an **existing** service;
it does not create IAP/IAM infrastructure or change access policies.

Set `PROJECT`, `REGION`, `PROXY_SERVICE`, `IMAGE` (an Artifact Registry image
with a unique version tag), `BACKEND_SERVICE_URL`, `PUBLIC_ORIGIN`, and
`IAM_AUDIENCE`:

```sh
docker build --platform linux/amd64 -t "$IMAGE" proxy
docker push "$IMAGE"
gcloud run services update "$PROXY_SERVICE" --project "$PROJECT" --region "$REGION" \
  --image "$IMAGE" \
  --update-env-vars "BACKEND_SERVICE_URL=$BACKEND_SERVICE_URL,PUBLIC_ORIGIN=$PUBLIC_ORIGIN,IAM_AUDIENCE=$IAM_AUDIENCE,LISTEN_HOST=0.0.0.0"
```

Review the image, service, and environment changes before applying. The deployer
needs Artifact Registry write, Cloud Run update, and permission to act as the
runtime service account. Check IAP login and `PUBLIC_ORIGIN/revisions/TAG/` in a
browser after deployment. New backend revision tags need no proxy updates.
Verify tag URLs with `gcloud run services describe`.

## Automatic deployment from main

After initial setup, `.github/workflows/cloud_run_proxy.yml` builds and deploys
the proxy on every push to `main`, including PR merges. Manual dispatch is also
available from `main`; other branches are skipped. The PR preview workflow
continues to manage backend revision tags independently.

Create the `cloud-run-proxy` GitHub Environment and register these secrets there
(repository secrets with the same names may also be used):

| Secret                           | Purpose                                                   |
| -------------------------------- | --------------------------------------------------------- |
| `GCP_PROJECT_ID`                 | Project containing the proxy service and image repository |
| `GCP_REGION`                     | Cloud Run and Artifact Registry region                    |
| `ARTIFACT_REGISTRY_REPOSITORY`   | Existing Docker image repository                          |
| `CLOUD_RUN_PROXY_SERVICE`        | Existing front proxy service, **not the backend**         |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Provider authorized for this workflow                     |
| `GCP_DEPLOY_SERVICE_ACCOUNT`     | Dedicated proxy deployment identity                       |

Use secrets for resource identifiers so Actions masks their values, following
the [preview workflow convention](../.github/CLOUD_RUN_PREVIEW.md). No
service-account key is needed. Restrict the Environment's deployment branches to
`main`. Required reviewers may be configured if an approval before each deploy
is desired; omit them for unattended main deployments.

The preview provider's `pull_request` condition does not authorize this
workflow. Use a separate provider for the proxy, or deliberately configure the
existing provider to allow the additional events. Map
`google.subject=assertion.sub` and `attribute.repository=assertion.repository`,
and restrict the proxy provider with the following condition, replacing the
example repository ID:

```text
assertion.repository == 'mukopikmin/sadoku' &&
assertion.repository_id == 'REPOSITORY_ID' &&
assertion.ref == 'refs/heads/main' &&
assertion.environment == 'cloud-run-proxy' &&
assertion.workflow_ref == 'mukopikmin/sadoku/.github/workflows/cloud_run_proxy.yml@refs/heads/main' &&
assertion.event_name in ['push', 'workflow_dispatch']
```

Scope the deployer's `roles/iam.workloadIdentityUser` binding to this
repository, and grant `roles/artifactregistry.writer` on the image repository,
`roles/run.developer` on **only the existing proxy service**, and
`roles/iam.serviceAccountUser` on its runtime service account. The runtime
account still needs backend `roles/run.invoker`. Provisioning the service, IAP
access, runtime configuration, and these IAM/WIF bindings is a one-time
infrastructure step outside the workflow.

The build job runs Go vet and race tests, then builds Linux/amd64 without cloud
credentials. The deploy job loads the image artifact before OIDC authentication;
it does not check out repository code. Images use a commit/run/attempt tag so
reruns work with immutable registry tags, and deployments use the pushed digest.
Deployments are serialized without interrupting a running deployment. GitHub may
replace a pending run with a newer one when merges arrive quickly.

Only the existing service's image and traffic are updated. Its environment
variables, runtime identity, ingress, and IAP/IAM policies are preserved. A new
revision is first created without traffic; after it is ready, it receives 100%
of traffic, including when the service previously pinned an older revision. An
update failure leaves the previous traffic assignment in place. A startup probe
does not verify browser IAP login or authenticated backend forwarding; check
`PUBLIC_ORIGIN/revisions/TAG/` after the first deployment.

For rollback, use `gcloud run services update-traffic` with
`--to-revisions PREVIOUS_REVISION=100`, or manually deploy a known-good image.
The next main push or manual dispatch will deploy main again.

421 indicates a `PUBLIC_ORIGIN`/Host mismatch. 502 indicates token acquisition,
upstream transport, or unsafe response URL errors; backend 401/403 indicate IAM
audience or invoker policy issues. SSE clients must reconnect after Cloud Run's
request timeout or instance shutdown (up to 8 seconds of graceful draining).
