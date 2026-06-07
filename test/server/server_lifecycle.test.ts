import { assertEquals } from "@std/assert";

import { createPreviewShutdownScheduler } from "../../src/server/server.ts";

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

Deno.test("shuts down only after the last event stream closes", async () => {
  let shutdowns = 0;
  const scheduler = createPreviewShutdownScheduler({
    delayMs: 20,
    filePath: "/tmp/example.md",
    shutdown: () => {
      shutdowns += 1;
      return Promise.resolve();
    },
  });

  scheduler.onEventStreamOpen();
  scheduler.onEventStreamOpen();
  scheduler.onEventStreamClose();
  await wait(40);
  assertEquals(shutdowns, 0);

  scheduler.onEventStreamClose();
  await wait(40);
  assertEquals(shutdowns, 1);
});

Deno.test("cancels pending shutdown when an event stream reconnects", async () => {
  let shutdowns = 0;
  const scheduler = createPreviewShutdownScheduler({
    delayMs: 30,
    filePath: "/tmp/example.md",
    shutdown: () => {
      shutdowns += 1;
      return Promise.resolve();
    },
  });

  scheduler.onEventStreamOpen();
  scheduler.onEventStreamClose();
  await wait(10);
  scheduler.onEventStreamOpen();
  await wait(40);
  assertEquals(shutdowns, 0);

  scheduler.onEventStreamClose();
  await wait(50);
  assertEquals(shutdowns, 1);
});

Deno.test("does not schedule shutdown when keepAlive is enabled", async () => {
  let shutdowns = 0;
  const scheduler = createPreviewShutdownScheduler({
    delayMs: 10,
    filePath: "/tmp/example.md",
    keepAlive: true,
    shutdown: () => {
      shutdowns += 1;
      return Promise.resolve();
    },
  });

  scheduler.onEventStreamOpen();
  scheduler.onEventStreamClose();
  await wait(30);

  assertEquals(shutdowns, 0);
});
