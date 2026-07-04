import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../db/connection.ts";
import { createSqliteCommentsStore } from "./sqlite_storage.ts";
import type { PreviewCommentsDocument } from "./types.ts";

const document = (filePath: string): PreviewCommentsDocument => ({
  comments: [
    {
      body: "First comment",
      createdAt: "2026-07-04T00:00:00.000Z",
      id: 1,
      line: 3,
      originalLine: 2,
      replies: [
        {
          body: "Reply",
          createdAt: "2026-07-04T00:01:00.000Z",
          id: 1,
          updatedAt: "2026-07-04T00:02:00.000Z",
        },
      ],
      resolved: false,
      sourceHash: "abc123",
      sourceText: "source line",
      stale: true,
      updatedAt: "2026-07-04T00:03:00.000Z",
    },
    {
      body: "Resolved comment",
      createdAt: "2026-07-04T00:04:00.000Z",
      id: 2,
      line: 8,
      originalLine: 8,
      resolved: true,
      resolvedAt: "2026-07-04T00:05:00.000Z",
      stale: false,
      updatedAt: "2026-07-04T00:06:00.000Z",
    },
  ],
  filePath,
});

Deno.test("sqlite comments store reads and writes documents by file path", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({ path: join(root, "comments.db") });
    try {
      const store = createSqliteCommentsStore(database);
      const firstPath = "/tmp/first.md";
      const secondPath = "/tmp/second.md";
      const firstDocument = document(firstPath);
      const secondDocument: PreviewCommentsDocument = {
        comments: [
          {
            body: "Second file comment",
            createdAt: "2026-07-04T01:00:00.000Z",
            id: 1,
            line: 1,
            originalLine: 1,
            resolved: false,
            stale: false,
            updatedAt: "2026-07-04T01:00:00.000Z",
          },
        ],
        filePath: secondPath,
      };

      await store.write(firstPath, firstDocument);
      await store.write(secondPath, secondDocument);

      assertEquals(await store.read(firstPath), firstDocument);
      assertEquals(await store.read(secondPath), secondDocument);
      assertEquals(await store.read("/tmp/missing.md"), {
        comments: [],
        filePath: "/tmp/missing.md",
      });
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("sqlite comments store replaces, lists, and deletes documents", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({ path: join(root, "comments.db") });
    try {
      const store = createSqliteCommentsStore(database);
      const filePath = "/tmp/listed.md";
      await store.write(filePath, document(filePath));
      await store.write(filePath, {
        comments: [
          {
            body: "Replacement",
            createdAt: "2026-07-04T02:00:00.000Z",
            id: 9,
            line: 10,
            originalLine: 10,
            resolved: false,
            stale: false,
            updatedAt: "2026-07-04T02:01:00.000Z",
          },
        ],
        filePath,
      });

      assertEquals(await store.list(), {
        entries: [
          {
            commentCount: 1,
            fileName: "listed.md",
            markdownPath: filePath,
            openCount: 1,
            updatedAt: "2026-07-04T02:01:00.000Z",
          },
        ],
        warnings: [],
      });

      await store.delete(filePath);

      assertEquals(await store.read(filePath), { comments: [], filePath });
      assertEquals(await store.list(), { entries: [], warnings: [] });
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
