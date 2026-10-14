export interface Env {
  BASE_DOMAIN: string;
  CLOUD_RUN_TAG_HOST: string;
}

const label = /^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const dnsLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function validDomain(value: string): boolean {
  return typeof value === "string" && value.length <= 253 &&
    value.includes(".") &&
    value.split(".").every((part) => dnsLabel.test(part));
}

export function validOrigin(value: string): boolean {
  return validDomain(value) && value.endsWith(".run.app") &&
    value !== "run.app" && !value.includes("---");
}

function failure(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
    },
  });
}

function removeHopHeaders(headers: Headers, websocket: boolean): void {
  const nominated = headers.get("Connection")?.split(",") ?? [];
  for (const name of nominated) {
    const trimmed = name.trim().toLowerCase();
    if (trimmed && !(websocket && trimmed === "upgrade")) {
      headers.delete(trimmed);
    }
  }
  for (
    const name of [
      "Connection",
      "Keep-Alive",
      "Proxy-Authenticate",
      "Proxy-Authorization",
      "TE",
      "Trailer",
      "Transfer-Encoding",
      "Upgrade",
    ]
  ) {
    headers.delete(name);
  }
  if (websocket) {
    headers.set("Connection", "Upgrade");
    headers.set("Upgrade", "websocket");
  }
}

function requestHeaders(
  request: Request,
  publicHost: string,
  upstreamHost: string,
  websocket: boolean,
): Headers {
  const headers = new Headers(request.headers);
  removeHopHeaders(headers, websocket);
  for (const name of [...headers.keys()]) {
    if (
      /^(?:x-forwarded-|cf-|x-original-|x-envoy-|x-goog-iap-|x-goog-authenticated-user-)/i
        .test(name) ||
      [
        "host",
        "forwarded",
        "x-real-ip",
        "true-client-ip",
        "x-rewrite-url",
        "x-serverless-authorization",
      ].includes(name.toLowerCase())
    ) {
      headers.delete(name);
    }
  }
  // IAP authenticates the caller using its session cookie or Authorization.
  // Client-supplied identity assertions must never impersonate IAP.
  headers.set("Host", upstreamHost);
  headers.set("X-Forwarded-Host", publicHost);
  headers.set("X-Forwarded-Proto", "https");
  headers.set("X-Forwarded-Port", "443");
  return headers;
}

function publicLocation(
  value: string,
  upstream: URL,
  publicHost: string,
  originHost: string,
  baseDomain: string,
): string {
  // Leave relative and unrelated external redirects intact. Never follow them
  // on the caller's behalf (especially with an Authorization header).
  const url = new URL(value, upstream);
  const absolute = /^[a-z][a-z0-9+.-]*:/i.test(value.trimStart()) ||
    /^[\\/]{2}/.test(value.trimStart());
  if (!absolute && url.host === upstream.host) return value;
  if (url.username || url.password) throw new Error("Unsafe redirect");
  if (url.hostname === upstream.hostname || url.hostname === originHost) {
    url.host = publicHost;
    url.protocol = "https:";
  } else if (url.hostname.endsWith(`---${originHost}`)) {
    const tag = url.hostname.slice(0, -(`---${originHost}`).length);
    if (!label.test(tag)) throw new Error("Unsafe redirect tag");
    url.host = `${tag}.${baseDomain}`;
    url.protocol = "https:";
  } else if (url.hostname.endsWith(".run.app")) {
    // A different Cloud Run service has no configured public mapping.
    throw new Error("Unmapped Cloud Run redirect");
  }
  return url.toString();
}

function hostOnlyCookie(cookie: string): string {
  // Set-Cookie is a list of independent fields: never split on commas (Expires
  // contains commas). Host-only cookies also isolate v1 from staging.
  return cookie.split(";").filter((part, index) =>
    index === 0 || !/^\s*domain\s*=/i.test(part)
  ).join(";");
}

export function createProxy(fetchOrigin: typeof fetch = fetch) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      if (
        !validDomain(env.BASE_DOMAIN) || !validOrigin(env.CLOUD_RUN_TAG_HOST)
      ) {
        return failure(500, "Invalid proxy configuration");
      }

      const incoming = new URL(request.url);
      const host = (request.headers.get("Host") ?? incoming.host).toLowerCase();
      if (host !== incoming.host.toLowerCase() || incoming.port) {
        return failure(400, "Invalid Host");
      }
      const suffix = `.${env.BASE_DOMAIN}`;
      if (!host.endsWith(suffix)) return failure(421, "Host not allowed");
      const tag = host.slice(0, -suffix.length);
      if (!label.test(tag) || tag.includes("---")) {
        return failure(400, "Invalid revision tag");
      }
      const upstreamHost = `${tag}---${env.CLOUD_RUN_TAG_HOST}`;
      if (!validDomain(upstreamHost)) {
        return failure(400, "Revision tag exceeds the origin DNS label limit");
      }
      if (incoming.protocol !== "https:") {
        return failure(400, "HTTPS required");
      }
      const upgrade = request.headers.get("Upgrade");
      const websocket = upgrade?.toLowerCase() === "websocket";
      if (upgrade && (!websocket || request.method !== "GET")) {
        return failure(400, "Unsupported upgrade");
      }

      // Assign only the authority. Resolving a path against an origin would
      // allow a path beginning with // to replace the destination host.
      const upstream = new URL(incoming);
      upstream.host = upstreamHost;
      upstream.username = "";
      upstream.password = "";
      upstream.hash = "";
      const outgoing = new Request(upstream, {
        method: request.method,
        headers: requestHeaders(request, host, upstreamHost, websocket),
        body: request.body,
        redirect: "manual",
        cache: "no-store",
        signal: request.signal,
      });

      let response: Response;
      try {
        response = await fetchOrigin(outgoing, { cache: "no-store" });
      } catch {
        return failure(502, "Cloud Run request failed");
      }
      const headers = new Headers(response.headers);
      const upgraded = websocket && response.status === 101;
      removeHopHeaders(headers, upgraded);
      try {
        const location = headers.get("Location");
        if (location) {
          headers.set(
            "Location",
            publicLocation(
              location,
              upstream,
              host,
              env.CLOUD_RUN_TAG_HOST,
              env.BASE_DOMAIN,
            ),
          );
        }
        // Refresh and Content-Location can also reveal an origin URL. The app
        // should generate these and body URLs using X-Forwarded-Host instead.
        headers.delete("Refresh");
        headers.delete("Content-Location");
      } catch {
        await response.body?.cancel();
        return failure(502, "Unsafe origin redirect");
      }
      const cookies = response.headers.getSetCookie();
      headers.delete("Set-Cookie");
      for (const cookie of cookies) {
        headers.append("Set-Cookie", hostOnlyCookie(cookie));
      }
      headers.set("Cache-Control", "no-store");
      headers.set("CDN-Cache-Control", "no-store");
      headers.set("Cloudflare-CDN-Cache-Control", "no-store");
      headers.delete("Surrogate-Control");
      headers.delete("Alt-Svc");

      // The extra property is consumed by the Workers Response constructor.
      // Keep the core portable so Deno can test the HTTP behavior too.
      const init = {
        status: response.status,
        statusText: response.statusText,
        headers,
        ...(upgraded && "webSocket" in response
          ? { webSocket: response.webSocket }
          : {}),
      };
      return new Response(response.body, init);
    },
  };
}

export default createProxy();
