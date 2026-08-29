import { assertEquals } from "@std/assert";
import { initializeSnapshotQueue } from "./snapshot_queue.ts";

const documents = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    filePath: `${index + 1}.md`,
  }));

Deno.test("snapshot queue limits concurrent work", async () => {
  let active = 0;
  let maximum = 0;
  const result = await initializeSnapshotQueue({
    concurrency: 2,
    documents: documents(6),
    readMarkdown: async (path) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return path;
    },
    initializeSnapshot: () => Promise.resolve(),
  });

  assertEquals(maximum, 2);
  assertEquals(result, {
    concurrency: 2,
    targetCount: 6,
    completedCount: 6,
    failedCount: 0,
  });
});

Deno.test("snapshot queue continues after read and save errors", async () => {
  const saved: number[] = [];
  const result = await initializeSnapshotQueue({
    documents: documents(4),
    readMarkdown: (path) =>
      path === "2.md"
        ? Promise.reject(new Error("read failed"))
        : Promise.resolve(path),
    initializeSnapshot: (id) => {
      if (id === 3) return Promise.reject(new Error("save failed"));
      saved.push(id);
      return Promise.resolve();
    },
  });

  assertEquals(saved, [1, 4]);
  assertEquals(result.completedCount, 2);
  assertEquals(result.failedCount, 2);
});

Deno.test("snapshot queue does not start files after cancellation", async () => {
  const controller = new AbortController();
  const reads: string[] = [];
  const result = await initializeSnapshotQueue({
    documents: documents(3),
    signal: controller.signal,
    readMarkdown: (path) => {
      reads.push(path);
      controller.abort();
      return Promise.resolve(path);
    },
    initializeSnapshot: () => Promise.resolve(),
  });

  assertEquals(reads, ["1.md"]);
  assertEquals(result.targetCount, 3);
  assertEquals(result.completedCount, 1);
});

Deno.test("snapshot queue handles empty input", async () => {
  const result = await initializeSnapshotQueue({
    documents: [],
    readMarkdown: () => Promise.reject(new Error("unexpected read")),
    initializeSnapshot: () => Promise.reject(new Error("unexpected save")),
  });
  assertEquals(result, {
    concurrency: 1,
    targetCount: 0,
    completedCount: 0,
    failedCount: 0,
  });
});
