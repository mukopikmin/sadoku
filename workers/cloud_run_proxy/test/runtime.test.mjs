import { after, before, test } from "node:test";
import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { createTestHarness } from "wrangler";

let worker;
let harness;
before(async () => {
  harness = createTestHarness({
    workers: [{
      config: {
        name: "proxy-runtime-test",
        main: "test/runtime_worker.ts",
        compatibility_date: "2026-10-09",
        vars: {
          BASE_DOMAIN: "api.example.com",
          CLOUD_RUN_TAG_HOST: "api-hash-an.a.run.app",
        },
      },
    }],
  });
  await harness.listen();
  worker = harness.getWorker();
});
after(async () => await harness?.close());

test("workerd preserves upload, authority, query and no-store subrequest", async () => {
  const response = await worker.fetch(
    "https://v1.api.example.com/upload?q=a%2Bb&q=2",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "X-Forwarded-Host": "evil.test",
      },
      body: "original-body",
    },
  );
  const data = await response.json();
  equal(data.method, "POST");
  equal(data.url, "https://v1---api-hash-an.a.run.app/upload?q=a%2Bb&q=2");
  equal(data.body, "original-body");
  equal(data.cache, "no-store");
  equal(data.headers["x-forwarded-host"], "v1.api.example.com");
  equal(response.headers.get("Cache-Control"), "no-store");
});

test("workerd streams SSE events and keeps multiple cookies", async () => {
  const response = await worker.fetch("https://v1.api.example.com/events", {
    headers: { Authorization: "Bearer test-token" },
  });
  equal(response.headers.get("Content-Type"), "text/event-stream");
  const reader = response.body.getReader();
  equal(
    new TextDecoder().decode((await reader.read()).value),
    "data: first\n\n",
  );
  equal(
    new TextDecoder().decode((await reader.read()).value),
    "data: second\n\n",
  );
  equal((await reader.read()).done, true);
  const cookies = await worker.fetch("https://v1.api.example.com/cookies", {
    headers: { Authorization: "Bearer test-token" },
  });
  deepStrictEqual(cookies.headers.getSetCookie(), [
    "a=1; Expires=Wed, 21 Oct 2030 07:28:00 GMT",
    "b=2; Secure; Path=/",
  ]);
});

test("workerd retains WebSocket upgrade and relays frames", async () => {
  const response = await worker.fetch("https://v1.api.example.com/ws", {
    headers: { Authorization: "Bearer test-token", Upgrade: "websocket" },
  });
  equal(response.status, 101);
  equal(response.headers.get("Set-Cookie"), "ws=1; Secure; Path=/");
  const socket = response.webSocket;
  ok(socket);
  socket.accept();
  try {
    const echoed = new Promise((resolve, reject) => {
      socket.addEventListener("message", (event) => resolve(event.data), {
        once: true,
      });
      socket.addEventListener("error", reject, { once: true });
    });
    socket.send("hello revision");
    equal(await echoed, "hello revision");
  } finally {
    socket.close(1000);
  }
});
