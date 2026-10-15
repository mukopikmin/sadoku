import { noStoreCacheControl, textResponse } from "../responses.ts";

export type RevisionProxyOptions = {
  /** Untagged status.url from Cloud Run; the service identifier stays opaque. */
  backendServiceUrl: string;
  /** Browser-facing HTTPS origin, independent of the container's HTTP transport. */
  publicOrigin: string;
  /** A later IAM adapter can authenticate this request before calling fetch. */
  fetchUpstream?: (request: Request) => Promise<Response>;
};

const parseOrigin = (value: string): URL => {
  const url = new URL(value);
  if (
    url.protocol !== "https:" || url.username || url.password ||
    value !== url.origin && value !== `${url.origin}/`
  ) throw new Error("Expected a canonical HTTPS origin without a path.");
  return url;
};

const hopByHopHeaders = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

const upstreamHeaders = (
  incoming: Headers,
  publicUrl: URL,
  basePath: string,
): Headers => {
  const headers = new Headers(incoming);
  for (const name of (headers.get("connection") ?? "").split(",")) {
    if (/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(name.trim())) {
      headers.delete(name.trim());
    }
  }
  for (const name of hopByHopHeaders) headers.delete(name);
  for (const name of [...headers.keys()]) {
    if (
      name === "host" || name === "content-length" || name === "forwarded" ||
      name.startsWith("x-forwarded-") || name.startsWith("x-goog-iap-") ||
      name === "x-serverless-authorization" || name === "x-original-url" ||
      name === "x-rewrite-url"
    ) headers.delete(name);
  }
  headers.set("x-forwarded-prefix", basePath);
  headers.set("x-forwarded-host", publicUrl.host);
  headers.set("x-forwarded-proto", publicUrl.protocol.slice(0, -1));
  return headers;
};

const errorResponse = (message: string, status: number): Response => {
  const response = textResponse(message, status);
  response.headers.set("cache-control", noStoreCacheControl);
  return response;
};

/** Routing core only: IAM, response URL/cookie rewriting and serving are separate. */
export const createRevisionProxy = (
  options: RevisionProxyOptions,
): (request: Request) => Promise<Response> => {
  const backend = parseOrigin(options.backendServiceUrl);
  const publicUrl = parseOrigin(options.publicOrigin);
  const labels = backend.hostname.split(".");
  if (
    backend.port || backend.hostname.length > 253 || labels.length < 3 ||
    !backend.hostname.endsWith(".run.app") ||
    !labels.every((label) =>
      label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    )
  ) throw new Error("Expected an untagged Cloud Run service origin.");
  const fetchUpstream = options.fetchUpstream ?? fetch;

  return async (request) => {
    const incoming = new URL(request.url);
    const host = request.headers.get("host");
    if (
      incoming.host !== publicUrl.host ||
      host !== null && host.toLowerCase() !== publicUrl.host
    ) return errorResponse("Host is not allowed.", 421);

    if (!incoming.pathname.startsWith("/revisions/")) {
      return errorResponse("Not found.", 404);
    }
    const route = /^\/revisions\/([^/]*)(\/.*)?$/.exec(incoming.pathname)!;
    const tag = route[1];
    if (
      !/^[a-z](?:[a-z0-9-]*[a-z0-9])?$/.test(tag) ||
      tag.length + 3 + labels[0].length > 63 ||
      tag.length + 3 + backend.hostname.length > 253
    ) return errorResponse("Invalid revision tag.", 400);

    const basePath = `/revisions/${tag}`;
    if (route[2] === undefined) {
      const location = new URL(`${basePath}/${incoming.search}`, publicUrl);
      return new Response(null, {
        status: 308,
        headers: {
          location: location.href,
          "cache-control": noStoreCacheControl,
        },
      });
    }

    // Cloud Run documents TAG---SERVICE_IDENTIFIER.run.app and the equivalent
    // deterministic form. Do not parse or reconstruct SERVICE_IDENTIFIER.
    const upstream = new URL(backend);
    upstream.hostname = `${tag}---${backend.hostname}`;
    upstream.pathname = route[2];
    upstream.search = incoming.search;
    const forwarded = new Request(upstream, {
      method: request.method,
      headers: upstreamHeaders(request.headers, publicUrl, basePath),
      body: request.body,
      signal: request.signal,
      redirect: "manual",
    });
    try {
      return await fetchUpstream(forwarded);
    } catch {
      return errorResponse("Upstream request failed.", 502);
    }
  };
};
