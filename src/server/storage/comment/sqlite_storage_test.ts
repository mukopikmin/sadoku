import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { openAppDatabase } from "../../db/connection.ts";
import { createSqliteCommentsStore } from "./sqlite_storage.ts";
import type { PreviewCommentsDocument } from "../../usecase/comment/types.ts";

const document = (filePath: string): PreviewCommentsDocument => ({
  comments: [
    {
      author: { type: "bot" },
      body: "First comment",
      createdAt: "2026-07-04T00:00:00.000Z",
      id: 1,
      endLine: 3,
      originalEndLine: 2,
      originalStartLine: 2,
      startLine: 3,
      replies: [
        {
          author: { type: "bot" },
          body: "Reply",
          createdAt: "2026-07-04T00:01:00.000Z",
          id: 1,
          reviewRequested: true,
          updatedAt: "2026-07-04T00:02:00.000Z",
        },
      ],
      resolved: false,
      sourceHash: "abc123",
      sourceText: "source line",
      sourceDeleted: true,
      stale: true,
      updatedAt: "2026-07-04T00:03:00.000Z",
    },
    {
      author: { type: "human" },
      body: "Resolved comment",
      createdAt: "2026-07-04T00:04:00.000Z",
      id: 2,
      endLine: 8,
      originalEndLine: 8,
      originalStartLine: 8,
      startLine: 8,
      replies: [],
      resolved: true,
      resolvedAt: "2026-07-04T00:05:00.000Z",
      resolvedBy: { type: "bot" },
      stale: false,
      updatedAt: "2026-07-04T00:06:00.000Z",
    },
  ],
  filePath,
  sourceSnapshot: "# Snapshot\n",
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
            author: { type: "human" },
            body: "Second file comment",
            createdAt: "2026-07-04T01:00:00.000Z",
            id: 1,
            endLine: 1,
            originalEndLine: 1,
            originalStartLine: 1,
            startLine: 1,
            replies: [],
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
            author: { type: "human" },
            body: "Replacement",
            createdAt: "2026-07-04T02:00:00.000Z",
            id: 9,
            endLine: 10,
            originalEndLine: 10,
            originalStartLine: 10,
            startLine: 10,
            replies: [],
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
      await assertRejects(() => store.delete(filePath), Deno.errors.NotFound);
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("sqlite comments store omits documents without comments", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({ path: join(root, "comments.db") });
    try {
      const store = createSqliteCommentsStore(database);
      const now = "2026-07-04T00:00:00.000Z";
      await database.execute(
        "INSERT INTO comment_document (file_path, created_at, updated_at) VALUES (?, ?, ?)",
        ["/tmp/no-comments.md", now, now],
      );
      const resolvedPath = "/tmp/resolved.md";
      const resolvedDocument = document(resolvedPath);
      resolvedDocument.comments = [
        { ...resolvedDocument.comments[1], resolved: true },
      ];
      await store.write(resolvedPath, resolvedDocument);

      assertEquals(
        (await store.list()).entries.map((entry) => ({
          markdownPath: entry.markdownPath,
          openCount: entry.openCount,
        })),
        [{ markdownPath: resolvedPath, openCount: 0 }],
      );
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("sqlite comments store retains all revisions across edits and reopen without duplicating unchanged snapshots", async () => {
  const root = await Deno.makeTempDir();
  const path = join(root, "comments.db");
  let database = await openAppDatabase({ path });
  try {
    let store = createSqliteCommentsStore(database);
    const filePath = "document.md";
    const initial = { ...document(filePath), sourceSnapshot: "A" };
    await store.write(filePath, initial);
    const values = ["A", "B", "C", "A", ""];
    for (let index = 1; index < values.length; index++) {
      const next = {
        ...initial,
        previousSourceSnapshot: values[index - 1],
        sourceSnapshot: values[index],
      };
      await store.write(filePath, next);
      // Comment-only updates must reuse both revision references.
      await store.write(filePath, {
        ...next,
        comments: [{ ...initial.comments[0], body: `Edit ${index}` }],
      });
      assertEquals((await store.read(filePath)).sourceSnapshot, values[index]);
      assertEquals(
        (await store.read(filePath)).previousSourceSnapshot,
        values[index - 1],
      );
    }
    database.close();
    database = await openAppDatabase({ path });
    store = createSqliteCommentsStore(database);
    assertEquals((await store.read(filePath)).sourceSnapshot, "");
    assertEquals((await store.read(filePath)).previousSourceSnapshot, "A");
    assertEquals(
      (await database.execute<{ markdown: string }>(
        "SELECT markdown FROM document_revision ORDER BY id",
      )).rows?.map((row) => row.markdown),
      values,
    );

    // Removing the public snapshots must not remove archived revisions.
    await store.write(filePath, { filePath, comments: [] });
    assertEquals(await store.read(filePath), { filePath, comments: [] });
    assertEquals(
      (await database.execute(
        "SELECT COUNT(*) AS count FROM document_revision",
      )).rows,
      [{ count: values.length }],
    );
  } finally {
    database.close();
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("sqlite comments store rolls back revisions and references when saving comments fails", async () => {
  const root = await Deno.makeTempDir();
  try {
    const database = await openAppDatabase({ path: join(root, "comments.db") });
    try {
      const store = createSqliteCommentsStore(database);
      const initial = document("document.md");
      await store.write(initial.filePath, initial);
      const revisions = await database.execute(
        "SELECT * FROM document_revision ORDER BY id",
      );
      await assertRejects(() =>
        store.write(initial.filePath, {
          ...initial,
          previousSourceSnapshot: initial.sourceSnapshot,
          sourceSnapshot: "changed",
          comments: [initial.comments[0], initial.comments[0]],
        })
      );
      assertEquals(await store.read(initial.filePath), initial);
      assertEquals(
        await database.execute("SELECT * FROM document_revision ORDER BY id"),
        revisions,
      );
      // A failed transaction must not block subsequent snapshot writes.
      await store.write(initial.filePath, {
        ...initial,
        previousSourceSnapshot: initial.sourceSnapshot,
        sourceSnapshot: "changed",
      });
      assertEquals(
        (await store.read(initial.filePath)).sourceSnapshot,
        "changed",
      );
    } finally {
      database.close();
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
