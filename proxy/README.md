# Revision proxy

Separate Cloud Run service: browser → native IAP → Go proxy → backend IAM →
tagged application. Set `PUBLIC_ORIGIN` to the browser-facing HTTPS origin,
including the mapped custom domain when one is configured. The proxy accepts
only that host; its `run.app` URL is not an alternative entry point when
`PUBLIC_ORIGIN` uses a custom domain. Revision links use
`PUBLIC_ORIGIN/revisions/TAG/`; no per-tag domain mapping or session affinity is
needed.

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
make test-proxy
BACKEND_SERVICE_URL=https://BACKEND.run.app PUBLIC_ORIGIN=https://FRONT.run.app \
  make run-proxy
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

## Manual deployment

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
runtime service account. No CD is configured. Check IAP login and
`PUBLIC_ORIGIN/revisions/TAG/` in a browser after deployment. New backend
revision tags need no proxy updates. Verify tag URLs with
`gcloud run services describe`.

421 indicates a `PUBLIC_ORIGIN`/Host mismatch. 502 indicates token acquisition,
upstream transport, or unsafe response URL errors; backend 401/403 indicate IAM
audience or invoker policy issues. SSE clients must reconnect after Cloud Run's
request timeout or instance shutdown (up to 8 seconds of graceful draining).
