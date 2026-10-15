import { deepEqual, equal, throws } from "node:assert/strict";
import { createRevisionProxy } from "./revision_proxy.ts";

const publicOrigin = "https://preview.example.com";
const backendServiceUrl = "https://sadoku-opaque-id.a.run.app";
const request = (path: string, init?: RequestInit) =>
  new Request(`${publicOrigin}${path}`, init);

Deno.test("routes tags dynamically while preserving paths and raw query strings", async () => {
  const seen: Request[] = [];
  const proxy = createRevisionProxy({
    publicOrigin,
    backendServiceUrl,
    fetchUpstream: (req) => {
      seen.push(req);
      return Promise.resolve(new Response("ok"));
    },
  });
  for (const tag of ["v1", "staging", "pr-42", "new-tag"]) {
    const response = await proxy(
      request(`/revisions/${tag}/documents/a%20b?x=1&x=2&q=a+b&next=%2F`),
    );
    equal(await response.text(), "ok");
    const forwarded = seen.at(-1)!;
    equal(
      forwarded.url,
      `https://${tag}---sadoku-opaque-id.a.run.app/documents/a%20b?x=1&x=2&q=a+b&next=%2F`,
    );
    equal(forwarded.headers.get("x-forwarded-prefix"), `/revisions/${tag}`);
    equal(forwarded.redirect, "manual");
  }
});

Deno.test("supports deterministic Cloud Run origins without reconstructing their fields", async () => {
  const proxy = createRevisionProxy({
    publicOrigin,
    backendServiceUrl: "https://api-123456789.asia-northeast1.run.app/",
    fetchUpstream: (req) => Promise.resolve(new Response(req.url)),
  });
  equal(
    await (await proxy(request("/revisions/v1/"))).text(),
    "https://v1---api-123456789.asia-northeast1.run.app/",
  );
});

Deno.test("rejects missing, encoded and malformed revision tags without fetching", async () => {
  const proxy = createRevisionProxy({
    publicOrigin,
    backendServiceUrl,
    fetchUpstream: () => {
      throw new Error("Must not fetch invalid routes");
    },
  });
  for (
    const tag of [
      "",
      "V1",
      "1v",
      "-v1",
      "v1-",
      "v_1",
      "v1.evil.test",
      "%76%31",
      "v1%2Fstaging",
      "v1%5Cstaging",
      "v1%252Fstaging",
      "%0A",
      "user@evil.test",
      "a".repeat(64),
    ]
  ) {
    const response = await proxy(request(`/revisions/${tag}/`));
    equal(response.status, 400, tag);
  }
  for (const path of ["/", "/documents", "/revisions", "//evil.test/"]) {
    equal((await proxy(request(path))).status, 404, path);
  }
});

Deno.test("rejects tagged host labels exceeding the DNS limit", async () => {
  const proxy = createRevisionProxy({
    publicOrigin,
    backendServiceUrl: `https://${"a".repeat(60)}.run.app`,
  });
  equal((await proxy(request("/revisions/v1/"))).status, 400);
});

Deno.test("rejects unsafe backend and public origin settings at construction", () => {
  for (
    const backend of [
      "http://sadoku.run.app",
      "https://evil.test",
      "https://run.app.evil.test",
      "https://127.0.0.1",
      "https://user:pass@sadoku.run.app",
      "https://sadoku.run.app:8443",
      "https://sadoku.run.app/path",
      "https://sadoku.run.app?target=evil",
      "https://sadoku.run.app#fragment",
      "https://bad_host.run.app",
      `https://${"a".repeat(64)}.run.app`,
    ]
  ) {
    throws(() =>
      createRevisionProxy({ publicOrigin, backendServiceUrl: backend })
    );
  }
  for (
    const origin of [
      "http://preview.example.com",
      "https://preview.example.com/path",
      "https://user:pass@preview.example.com",
      "https://preview.example.com?q=1",
    ]
  ) {
    throws(() =>
      createRevisionProxy({ publicOrigin: origin, backendServiceUrl })
    );
  }
});

Deno.test("rejects unconfigured URL and Host header authorities", async () => {
  const proxy = createRevisionProxy({ publicOrigin, backendServiceUrl });
  for (
    const req of [
      new Request("https://evil.test/revisions/v1/"),
      request("/revisions/v1/", { headers: { host: "evil.test" } }),
      request("/revisions/v1/", {
        headers: { host: "preview.example.com:1234" },
      }),
    ]
  ) equal((await proxy(req)).status, 421);
});

Deno.test("canonicalizes the tag root with a method-preserving redirect and query", async () => {
  const proxy = createRevisionProxy({ publicOrigin, backendServiceUrl });
  const response = await proxy(
    request("/revisions/v1?x=1&next=%2F", { method: "POST", body: "payload" }),
  );
  equal(response.status, 308);
  equal(
    response.headers.get("location"),
    `${publicOrigin}/revisions/v1/?x=1&next=%2F`,
  );
  equal(response.headers.get("cache-control"), "no-store");
});

Deno.test("uses the configured HTTPS origin when Cloud Run terminates TLS before the container", async () => {
  const proxy = createRevisionProxy({
    publicOrigin,
    backendServiceUrl,
    fetchUpstream: (req) => {
      equal(req.headers.get("x-forwarded-proto"), "https");
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  });
  equal(
    (await proxy(new Request("http://preview.example.com/revisions/v1/")))
      .status,
    204,
  );
  equal(
    (await proxy(new Request("http://preview.example.com/revisions/v1")))
      .headers.get("location"),
    `${publicOrigin}/revisions/v1/`,
  );
});

Deno.test("preserves HTTP methods and binary request bodies", async () => {
  const payload = new Uint8Array([0, 1, 127, 128, 255]);
  for (
    const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  ) {
    const hasBody = !["GET", "HEAD"].includes(method);
    const proxy = createRevisionProxy({
      publicOrigin,
      backendServiceUrl,
      fetchUpstream: async (req) => {
        equal(req.method, method);
        equal(req.headers.get("content-type"), "application/octet-stream");
        deepEqual(
          new Uint8Array(await req.arrayBuffer()),
          hasBody ? payload : new Uint8Array(),
        );
        return new Response(null, { status: 204 });
      },
    });
    equal(
      (await proxy(request("/revisions/v1/resource", {
        method,
        headers: { "content-type": "application/octet-stream" },
        body: hasBody ? payload : null,
      }))).status,
      204,
    );
  }
});

Deno.test("sets trusted forwarding headers and removes spoofed and hop-by-hop headers", async () => {
  const proxy = createRevisionProxy({
    publicOrigin,
    backendServiceUrl,
    fetchUpstream: (req) => {
      for (
        const name of [
          "host",
          "connection",
          "x-private",
          "keep-alive",
          "transfer-encoding",
          "content-length",
          "forwarded",
          "x-forwarded-for",
          "x-forwarded-port",
          "x-goog-iap-jwt-assertion",
          "x-serverless-authorization",
          "x-original-url",
          "x-rewrite-url",
        ]
      ) equal(req.headers.get(name), null, name);
      equal(req.headers.get("x-forwarded-prefix"), "/revisions/staging");
      equal(req.headers.get("x-forwarded-host"), "preview.example.com");
      equal(req.headers.get("x-forwarded-proto"), "https");
      equal(req.headers.get("authorization"), "Bearer application-token");
      equal(req.headers.get("cookie"), "session=app-cookie");
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  });
  equal(
    (await proxy(request("/revisions/staging/", {
      headers: {
        host: "preview.example.com",
        connection: "x-private, x-forwarded-prefix, invalid token",
        "x-private": "secret",
        "keep-alive": "timeout=5",
        "transfer-encoding": "chunked",
        "content-length": "0",
        forwarded: "host=evil.test;proto=http",
        "x-forwarded-for": "127.0.0.1",
        "x-forwarded-port": "80",
        "x-forwarded-host": "evil.test",
        "x-forwarded-proto": "http",
        "x-forwarded-prefix": "/evil",
        "x-goog-iap-jwt-assertion": "untrusted",
        "x-serverless-authorization": "Bearer untrusted",
        "x-original-url": "https://evil.test",
        "x-rewrite-url": "https://evil.test",
        authorization: "Bearer application-token",
        cookie: "session=app-cookie",
      },
    }))).status,
    204,
  );
});

Deno.test("keeps double-slash paths and URL-shaped query values on the fixed backend", async () => {
  const proxy = createRevisionProxy({
    publicOrigin,
    backendServiceUrl,
    fetchUpstream: (req) => {
      equal(new URL(req.url).host, "v1---sadoku-opaque-id.a.run.app");
      equal(new URL(req.url).pathname, "//evil.test/path");
      return Promise.resolve(new Response("ok"));
    },
  });
  equal(
    (await proxy(
      request("/revisions/v1//evil.test/path?url=https://evil.test"),
    )).status,
    200,
  );
});

Deno.test("passes request streams through without pre-reading and propagates cancellation", async () => {
  let reads = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      reads++;
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  }, { highWaterMark: 0 });
  const abort = new AbortController();
  const proxy = createRevisionProxy({
    publicOrigin,
    backendServiceUrl,
    fetchUpstream: async (req) => {
      equal(reads, 0);
      equal(req.body, body);
      abort.abort();
      equal(req.signal.aborted, true);
      await req.body!.cancel();
      return new Response(null, { status: 204 });
    },
  });
  equal(
    (await proxy(request("/revisions/v1/", {
      method: "POST",
      body,
      signal: abort.signal,
    }))).status,
    204,
  );
});

Deno.test("returns large responses and open SSE streams without buffering", async () => {
  for (const sse of [false, true]) {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    });
    const upstream = new Response(body, {
      headers: {
        "content-type": sse ? "text/event-stream" : "application/octet-stream",
      },
    });
    const proxy = createRevisionProxy({
      publicOrigin,
      backendServiceUrl,
      fetchUpstream: () => Promise.resolve(upstream),
    });
    const response = await proxy(request("/revisions/v1/events"));
    equal(response.body, body);
    const reader = response.body!.getReader();
    const chunk = sse
      ? new TextEncoder().encode("data: first\n\n")
      : new Uint8Array(1024 * 1024);
    controller.enqueue(chunk);
    equal((await reader.read()).value, chunk);
    // The first chunk is available while the upstream remains open.
    await reader.cancel();
  }
});

Deno.test("preserves upstream 4xx, 5xx and redirects without following or retrying", async () => {
  for (const status of [302, 400, 401, 403, 404, 429, 500, 503]) {
    let calls = 0;
    const proxy = createRevisionProxy({
      publicOrigin,
      backendServiceUrl,
      fetchUpstream: (req) => {
        calls++;
        equal(req.redirect, "manual");
        return Promise.resolve(
          new Response("upstream", {
            status,
            headers: { location: "https://evil.test/", "retry-after": "5" },
          }),
        );
      },
    });
    const response = await proxy(request("/revisions/nonexistent/"));
    equal(response.status, status);
    equal(await response.text(), "upstream");
    equal(response.headers.get("retry-after"), "5");
    equal(calls, 1);
  }
});

Deno.test("maps transport failures to a generic 502 without exposing backend details", async () => {
  const proxy = createRevisionProxy({
    publicOrigin,
    backendServiceUrl,
    fetchUpstream: () => Promise.reject(new Error("private backend details")),
  });
  const response = await proxy(request("/revisions/v1/"));
  equal(response.status, 502);
  equal(await response.text(), "Upstream request failed.");
  equal(response.headers.get("cache-control"), "no-store");
});
