# Cloud Run tag proxy

Routes `TAG.api.example.com` through Cloudflare Workers to the corresponding
Cloud Run revision tag. New tags need no DNS changes or Worker redeployment. No
Google load balancer, Domain Mapping, or Session Affinity is used.

## Setup

- Keep
  [IAP enabled directly on Cloud Run](https://docs.cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run).
  Users need `roles/iap.httpsResourceAccessor`; the IAP service agent needs
  `roles/run.invoker`. The `run.app` endpoint must be reachable from Cloudflare.
  IAP handles browser login and authorization; the Worker forwards cookies and
  login redirects without requiring a Bearer token or issuing credentials.
- Create one proxied wildcard DNS A record: `*.api.example.com` → `192.0.2.1`
  (dummy origin). Check for conflicting DNS records and Worker routes.
- Activate a certificate covering `*.api.example.com`. Universal SSL for
  `*.example.com` does not cover this depth; use
  [Advanced Certificate Manager](https://developers.cloudflare.com/ssl/edge-certificates/advanced-certificate-manager/)
  or a supported custom certificate. Workers Free or Paid can run the proxy.
- Use Wrangler login or an API token scoped to the target account/zone with
  **Workers Scripts Edit**, **Workers Routes Edit**, and **Zone Read**. Keep
  tokens out of source files and logs.

## Verify and deploy

Requires Node.js 24 and Deno 2.8. Run locally before each deployment:

```sh
cd workers/cloud_run_proxy
npm install
npm run lint
npm run typecheck
npm run typecheck:workers
npm test
npm run build
npm run test:runtime
```

Read the actual URLs; do not infer a tagged URL from the service URL:

```sh
gcloud run services describe "$SERVICE" \
  --project "$PROJECT_ID" --region "$REGION" --format=json
```

Set these variables, replacing placeholders with the output and your Cloudflare
settings. Select an existing tag and its matching `status.traffic[].url`:

```sh
export BASE_DOMAIN=api.example.com
export WORKER_NAME=sadoku-cloud-run-proxy
export CLOUDFLARE_ACCOUNT_ID='<32-character account ID>'
export CLOUDFLARE_ZONE_ID='<32-character zone ID>'
export CLOUD_RUN_SERVICE_URL='<status.url>'
export CLOUD_RUN_SAMPLE_TAG=v1
export CLOUD_RUN_SAMPLE_TAG_URL='<URL returned for the v1 tag>'
npm run configure
```

Review the ignored `wrangler.deploy.json`, DNS, TLS, and route changes, then run
`npm run deploy`. Wrangler manages the Worker, bindings, and one wildcard route;
DNS and certificates are managed separately. There is no Worker CI/CD or
required GitHub Secrets. Deploy manually for Worker code/configuration changes
only.

For local development, set `BASE_DOMAIN` and the generated `CLOUD_RUN_TAG_HOST`
in ignored `.dev.vars`, then run `npm run dev`. Preserve the public Host when
connecting to the local HTTPS server:

```sh
curl --insecure --noproxy '*' \
  --connect-to v1.api.example.com:443:127.0.0.1:8787 \
  --header 'Accept: text/html' https://v1.api.example.com/
```

Use `--insecure` only for the local certificate. Local requests reach real Cloud
Run; use a development service for writes.

## Add a tag

Existing PR preview tags work automatically. To tag another revision:

```sh
gcloud run services update-traffic "$SERVICE" \
  --project "$PROJECT_ID" --region "$REGION" --update-tags "v2=$REVISION"
```

Open `https://v2.api.example.com` in a browser, sign in through IAP, and verify
the expected revision. Tags must start with a lowercase letter, contain
lowercase letters, digits or hyphens, end with a letter/digit, and contain no
`---`. The upstream `TAG---SERVICE_IDENTIFIER` DNS label must fit within 63
characters.

## Limitations

Browser SSE and WebSocket can use an established IAP session cookie. Cookies
become host-only; internal redirects are rewritten, but absolute URLs in
response bodies are the application's responsibility. Caching is disabled.

Before production use, verify the full IAP login/logout flow, callback domain,
cookie persistence, denied users, and a new tag on the public domain. Mock tests
do not prove this flow works through an alternate hostname; OAuth state and
embedded login return URLs are not rewritten. For 401/403, check IAP access and
session validity; for 404, check the tag; for 502, check the origin and
connectivity.
