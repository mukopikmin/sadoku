import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { createProxy, type Env } from "./index.ts";

const env: Env = {
  BASE_DOMAIN: "api.example.com",
  CLOUD_RUN_TAG_HOST: "api-abcdef-an.a.run.app",
};

function incoming(
  path = "/",
  init: RequestInit = {},
  host = "v1.api.example.com",
) {
  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", "Bearer test-token");
  }
  return new Request(`https://${host}${path}`, { ...init, headers });
}

function stub(handler: (request: Request) => Response | Promise<Response>) {
  const calls: Request[] = [];
  const proxy = createProxy((input, init) => {
    ok(input instanceof Request);
    deepStrictEqual(init, { cache: "no-store" });
    calls.push(input);
    return Promise.resolve(handler(input));
  });
  return { calls, proxy };
}

for (const tag of ["v1", "staging", "pr-42", "new-tag-with-no-config-change"]) {
  Deno.test(`${tag} dynamically selects the revision tag`, async () => {
    const { proxy, calls } = stub(() => new Response("ok"));
    const response = await proxy.fetch(
      incoming("/", {}, `${tag}.${env.BASE_DOMAIN}`),
      env,
    );
    equal(await response.text(), "ok");
    equal(new URL(calls[0].url).host, `${tag}---${env.CLOUD_RUN_TAG_HOST}`);
  });
}

for (
  const host of [
    "api.example.com",
    "v1.api.example.com.evil.test",
    "v1.other.example.com",
    "v1api.example.com",
    "evil.test",
    "a.b.api.example.com",
    "-v1.api.example.com",
    "v1-.api.example.com",
    "1v.api.example.com",
    "bad_tag.api.example.com",
    "v1---evil.api.example.com",
    `${"a".repeat(64)}.api.example.com`,
    `${"a".repeat(60)}.api.example.com`,
    "v1.api.example.com:8443",
    "v1.api.example.com.",
  ]
) {
  Deno.test(`rejects unauthorized or invalid Host ${host}`, async () => {
    const { proxy, calls } = stub(() => new Response("must not fetch"));
    const response = await proxy.fetch(incoming("/", {}, host), env);
    ok(response.status >= 400 && response.status < 500);
    equal(calls.length, 0);
  });
}

Deno.test("rejects a Host header different from the request URL", async () => {
  const { proxy, calls } = stub(() => new Response());
  equal(
    (await proxy.fetch(incoming("/", { headers: { Host: "evil.test" } }), env))
      .status,
    400,
  );
  equal(calls.length, 0);
});

Deno.test("normalizes DNS case and requires HTTPS", async () => {
  const { proxy, calls } = stub(() => new Response());
  equal(
    (await proxy.fetch(
      incoming("/", { headers: { Host: "V1.API.EXAMPLE.COM" } }),
      env,
    )).status,
    200,
  );
  equal(new URL(calls[0].url).host, `v1---${env.CLOUD_RUN_TAG_HOST}`);
  equal(
    (await proxy.fetch(new Request("http://v1.api.example.com/"), env)).status,
    400,
  );
  equal(calls.length, 1);
});

for (
  const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
) {
  Deno.test(`${method} preserves method, encoded path, query and body`, async () => {
    const payload = new Uint8Array([0, 1, 128, 255]);
    const hasBody = !["GET", "HEAD"].includes(method);
    const { proxy, calls } = stub(async (request) => {
      if (hasBody) {
        deepStrictEqual(new Uint8Array(await request.arrayBuffer()), payload);
      } else equal(request.body, null);
      return new Response(null, { status: 204 });
    });
    const response = await proxy.fetch(
      incoming("/a%2Fb//c?q=a%2Bb&q=2&empty=", {
        method,
        body: hasBody ? payload : undefined,
        headers: { "Content-Type": "application/octet-stream" },
      }),
      env,
    );
    equal(response.status, 204);
    equal(calls[0].method, method);
    equal(
      calls[0].url,
      `https://v1---${env.CLOUD_RUN_TAG_HOST}/a%2Fb//c?q=a%2Bb&q=2&empty=`,
    );
    equal(calls[0].headers.get("Content-Type"), "application/octet-stream");
    equal(calls[0].redirect, "manual");
  });
}

Deno.test("does not pre-read a streaming upload", async () => {
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const { proxy } = stub((request) => {
    ok(request.body);
    equal(request.bodyUsed, false);
    return new Response(request.body);
  });
  const response = await proxy.fetch(
    incoming("/", { method: "POST", body: stream.readable }),
    env,
  );
  const writer = stream.writable.getWriter();
  const reader = response.body!.getReader();
  const writing = writer.write(new Uint8Array([123]));
  deepStrictEqual((await reader.read()).value, new Uint8Array([123]));
  await writing;
  await writer.close();
  equal((await reader.read()).done, true);
});

Deno.test("removes spoofed forwarding/identity and hop headers", async () => {
  const { proxy, calls } = stub(() => new Response());
  await proxy.fetch(
    incoming("/", {
      headers: {
        "X-Forwarded-Host": "evil.test",
        "X-Forwarded-For": "127.0.0.1",
        "X-Forwarded-Proto": "http",
        "X-Forwarded-Port": "1",
        "X-Forwarded-Prefix": "/admin",
        "Forwarded": "host=evil.test;for=127.0.0.1",
        "X-Real-IP": "127.0.0.1",
        "CF-Connecting-IP": "127.0.0.1",
        "CF-Access-Jwt-Assertion": "fake-access-token",
        "X-Serverless-Authorization": "Bearer forged",
        "X-Original-URL": "https://evil.test",
        "X-Rewrite-URL": "/admin",
        "Connection": "keep-alive, x-hop",
        "X-Hop": "remove",
        "Cookie": "app=original",
      },
    }),
    env,
  );
  const headers = calls[0].headers;
  equal(headers.get("Host"), `v1---${env.CLOUD_RUN_TAG_HOST}`);
  equal(headers.get("X-Forwarded-Host"), "v1.api.example.com");
  equal(headers.get("X-Forwarded-Proto"), "https");
  equal(headers.get("X-Forwarded-Port"), "443");
  equal(headers.get("Authorization"), "Bearer test-token");
  equal(headers.get("Cookie"), "app=original");
  for (
    const header of [
      "X-Forwarded-For",
      "X-Forwarded-Prefix",
      "Forwarded",
      "X-Real-IP",
      "CF-Connecting-IP",
      "CF-Access-Jwt-Assertion",
      "X-Serverless-Authorization",
      "X-Original-URL",
      "X-Rewrite-URL",
      "Connection",
      "X-Hop",
    ]
  ) equal(headers.get(header), null);
});

Deno.test("missing authentication fails closed without calling origin", async () => {
  const { proxy, calls } = stub(() => new Response());
  for (const authorization of ["", "Basic secret", "Bearer", "Bearer a b"]) {
    equal(
      (await proxy.fetch(
        incoming("/", { headers: { Authorization: authorization } }),
        env,
      )).status,
      401,
    );
  }
  equal(calls.length, 0);
});

for (
  const path of [
    "//evil.test/a",
    "/%2F%2Fevil.test/a",
    "/?url=https://evil.test&tag=attacker",
  ]
) {
  Deno.test(`cannot replace the upstream host using ${path}`, async () => {
    const { proxy, calls } = stub(() => new Response());
    await proxy.fetch(incoming(path), env);
    equal(new URL(calls[0].url).host, `v1---${env.CLOUD_RUN_TAG_HOST}`);
  });
}

for (
  const origin of [
    "evil.test",
    "run.app",
    "api.run.app.evil.test",
    "https://api.run.app",
    "v1---api.run.app",
    "user@api.run.app",
    "api.run.app:443",
  ]
) {
  Deno.test(`invalid configured origin ${origin} fails closed`, async () => {
    const { proxy, calls } = stub(() => new Response());
    equal(
      (await proxy.fetch(incoming(), { ...env, CLOUD_RUN_TAG_HOST: origin }))
        .status,
      500,
    );
    equal(calls.length, 0);
  });
}

for (const status of [400, 401, 403, 404, 429, 500, 503]) {
  Deno.test(`Cloud Run ${status}, including missing tags, is preserved`, async () => {
    const { proxy } = stub(() => new Response("origin error", { status }));
    const response = await proxy.fetch(incoming(), env);
    equal(response.status, status);
    equal(await response.text(), "origin error");
    equal(response.headers.get("Cache-Control"), "no-store");
  });
}

Deno.test("DNS/network failure returns a generic 502", async () => {
  const proxy = createProxy(() =>
    Promise.reject(new Error("secret origin details"))
  );
  const response = await proxy.fetch(incoming(), env);
  equal(response.status, 502);
  equal(await response.text(), "Cloud Run request failed");
});

Deno.test("large response is incremental and client cancellation reaches origin", async () => {
  let canceled = false;
  let sent = 0;
  const chunk = new Uint8Array(1024 * 1024);
  const stream = new ReadableStream({
    pull(controller) {
      if (sent++ < 160) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() {
      canceled = true;
    },
  });
  const { proxy } = stub(() => new Response(stream));
  const response = await proxy.fetch(incoming(), env);
  ok(sent < 3, "must return before reading the 160 MiB body");
  const reader = response.body!.getReader();
  equal((await reader.read()).value!.byteLength, chunk.byteLength);
  await reader.cancel();
  equal(canceled, true);
});

Deno.test("SSE delivers an event while the origin stream remains open", async () => {
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const { proxy } = stub(() =>
    new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Transfer-Encoding": "chunked",
      },
    })
  );
  const response = await proxy.fetch(incoming("/events"), env);
  equal(response.headers.get("Content-Type"), "text/event-stream");
  equal(response.headers.get("Transfer-Encoding"), null);
  const reader = response.body!.getReader();
  const writer = stream.writable.getWriter();
  for (const event of ["data: first\n\n", "data: second\n\n"]) {
    const writing = writer.write(new TextEncoder().encode(event));
    equal(new TextDecoder().decode((await reader.read()).value), event);
    await writing;
  }
  await writer.close();
  equal((await reader.read()).done, true);
});

for (
  const [location, expected] of [
    [
      `https://v1---${env.CLOUD_RUN_TAG_HOST}/login?q=1#anchor`,
      "https://v1.api.example.com/login?q=1#anchor",
    ],
    [
      `http://${env.CLOUD_RUN_TAG_HOST}/login`,
      "https://v1.api.example.com/login",
    ],
    [
      `//staging---${env.CLOUD_RUN_TAG_HOST}/next`,
      "https://staging.api.example.com/next",
    ],
    ["/relative?q=2", "/relative?q=2"],
    ["../relative", "../relative"],
    ["https://login.example.net/oauth", "https://login.example.net/oauth"],
    [
      `https:${String.fromCharCode(92).repeat(2)}${env.CLOUD_RUN_TAG_HOST}${
        String.fromCharCode(92)
      }login`,
      "https://v1.api.example.com/login",
    ],
  ]
) {
  Deno.test(`manual redirect ${location}`, async () => {
    const { proxy, calls } = stub(() =>
      new Response(null, { status: 307, headers: { Location: location } })
    );
    const response = await proxy.fetch(incoming(), env);
    equal(response.status, 307);
    equal(response.headers.get("Location"), expected);
    equal(calls.length, 1);
  });
}

Deno.test("unmapped Cloud Run redirects never expose or fetch that service", async () => {
  const { proxy, calls } = stub(() =>
    new Response(null, {
      status: 302,
      headers: { Location: "https://different-service.run.app/" },
    })
  );
  const response = await proxy.fetch(incoming(), env);
  equal(response.status, 502);
  equal(response.headers.get("Location"), null);
  equal(calls.length, 1);
});

Deno.test("missing runtime bindings fail closed", async () => {
  const { proxy, calls } = stub(() => new Response());
  equal((await proxy.fetch(incoming(), {} as Env)).status, 500);
  equal(calls.length, 0);
});

Deno.test("cookies remain separate, retain Expires and become host-only", async () => {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `session=a; Domain=.${env.CLOUD_RUN_TAG_HOST}; Path=/; Secure; HttpOnly; SameSite=Lax`,
  );
  headers.append(
    "Set-Cookie",
    "prefs=b; DOMAIN=example.com; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/",
  );
  headers.append("Set-Cookie", "__Host-token=c; Path=/; Secure");
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("Surrogate-Control", "max-age=86400");
  const { proxy } = stub(() => new Response("body", { headers }));
  const response = await proxy.fetch(incoming(), env);
  deepStrictEqual(response.headers.getSetCookie(), [
    "session=a; Path=/; Secure; HttpOnly; SameSite=Lax",
    "prefs=b; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/",
    "__Host-token=c; Path=/; Secure",
  ]);
  for (
    const name of [
      "Cache-Control",
      "CDN-Cache-Control",
      "Cloudflare-CDN-Cache-Control",
    ]
  ) {
    equal(response.headers.get(name), "no-store");
  }
  equal(response.headers.get("Surrogate-Control"), null);
});

Deno.test("WebSocket upgrade is forwarded without consuming the response", async () => {
  const { proxy, calls } = stub(() => new Response(null, { status: 403 }));
  equal(
    (await proxy.fetch(
      incoming("/ws", {
        headers: {
          Upgrade: "websocket",
          Connection: "upgrade",
          "Sec-WebSocket-Protocol": "chat",
        },
      }),
      env,
    )).status,
    403,
  );
  equal(calls[0].headers.get("Upgrade"), "websocket");
  equal(calls[0].headers.get("Connection"), "Upgrade");
  equal(calls[0].headers.get("Sec-WebSocket-Protocol"), "chat");
  equal(
    (await proxy.fetch(incoming("/ws", { headers: { Upgrade: "h2c" } }), env))
      .status,
    400,
  );
  equal(calls.length, 1);
});
