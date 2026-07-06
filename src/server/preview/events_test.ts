import { assertEquals } from "@std/assert";
import { resolve } from "@std/path";

import { createHotReloadEventStream } from "./events.ts";

const readWithTimeout = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array> | "timeout"> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<"timeout">((resolveTimeout) => {
        timeout = setTimeout(() => resolveTimeout("timeout"), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
};

const readUntilDone = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if ((await reader.read()).done) return;
  }
  throw new Error("Event stream did not close.");
};

class TestFsWatcher implements AsyncIterable<Deno.FsEvent> {
  #closed = false;
  #events: Deno.FsEvent[] = [];
  #waiting: (() => void) | undefined;

  close(): void {
    this.#closed = true;
    this.#waiting?.();
    this.#waiting = undefined;
  }

  push(event: Deno.FsEvent): void {
    this.#events.push(event);
    this.#waiting?.();
    this.#waiting = undefined;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Deno.FsEvent> {
    while (!this.#closed) {
      const event = this.#events.shift();
      if (event) {
        yield event;
        continue;
      }
      await new Promise<void>((resolveWaiting) => {
        this.#waiting = resolveWaiting;
      });
    }
  }
}

Deno.test("emits a reload event when the Markdown file changes", async () => {
  const directory = await Deno.makeTempDir({ prefix: "sadoku-events-" });
  const filePath = resolve(directory, "document.md");
  await Deno.writeTextFile(filePath, "first");
  const controller = new AbortController();
  const watcher = new TestFsWatcher();
  let opened = 0;
  let closed = 0;
  const stream = createHotReloadEventStream(
    filePath,
    controller.signal,
    {
      onEventStreamOpen: () => opened += 1,
      onEventStreamClose: () => closed += 1,
      watchFs: () => watcher,
    },
  );
  const reader = stream.getReader();

  try {
    const readResult = readWithTimeout(reader, 2_000);
    watcher.push({ kind: "modify", paths: [filePath] });
    const result = await readResult;

    assertEquals(opened, 1);
    assertEquals(result === "timeout", false);
    if (result !== "timeout") {
      assertEquals(result.done, false);
      assertEquals(
        new TextDecoder().decode(result.value),
        "event: reload\ndata: {}\n\n",
      );
    }

    controller.abort();
    await readUntilDone(reader);
    assertEquals(closed, 1);
  } finally {
    controller.abort();
    await reader.cancel().catch(() => {});
    await Deno.remove(directory, { recursive: true }).catch(() => {});
  }
});

Deno.test("ignores changes to other files in the watched directory", async () => {
  const directory = await Deno.makeTempDir({ prefix: "sadoku-events-" });
  const filePath = resolve(directory, "document.md");
  const otherPath = resolve(directory, "other.md");
  await Deno.writeTextFile(filePath, "document");
  await Deno.writeTextFile(otherPath, "first");
  const controller = new AbortController();
  const stream = createHotReloadEventStream(filePath, controller.signal);
  const reader = stream.getReader();

  try {
    await Deno.writeTextFile(otherPath, "second");
    assertEquals(await readWithTimeout(reader, 250), "timeout");
  } finally {
    controller.abort();
    await reader.cancel().catch(() => {});
    await Deno.remove(directory, { recursive: true }).catch(() => {});
  }
});

Deno.test("reports stream closure only once after abort and cancellation", async () => {
  const directory = await Deno.makeTempDir({ prefix: "sadoku-events-" });
  const filePath = resolve(directory, "document.md");
  await Deno.writeTextFile(filePath, "document");
  const controller = new AbortController();
  let closed = 0;
  const stream = createHotReloadEventStream(filePath, controller.signal, {
    onEventStreamClose: () => closed += 1,
  });
  const reader = stream.getReader();

  try {
    controller.abort();
    await readUntilDone(reader);
    await reader.cancel();
    assertEquals(closed, 1);
  } finally {
    controller.abort();
    await Deno.remove(directory, { recursive: true }).catch(() => {});
  }
});
