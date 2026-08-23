import { assertEquals } from "@std/assert";
import { join, resolve } from "@std/path";
import { createDirectoryPreviewHandler } from "./directory_handler.ts";
import type { CommentsStore } from "./storage/comment/storage.ts";
import type { PreviewCommentsDocument } from "./usecase/comment/types.ts";
import type { DirectorySession } from "./usecase/document/mod.ts";
import type { DocumentStore } from "./usecase/document/mod.ts";
import { serveHandlerInfo } from "./test_helpers.ts";
import { ensureCommentsNotificationDirectory } from "./storage/comment/notifications.ts";

const createMemoryStore = (): CommentsStore => {
  const documents = new Map<string, PreviewCommentsDocument>();
  return {
    delete: (path) => {
      documents.delete(path);
      return Promise.resolve();
    },
    list: () => Promise.resolve({ entries: [], warnings: [] }),
    read: (path) =>
      Promise.resolve(structuredClone(
        documents.get(path) ?? {
          comments: [],
          filePath: path,
        },
      )),
    write: (path, document) => {
      documents.set(path, structuredClone(document));
      return Promise.resolve();
    },
  };
};

const request = (
  handler: Deno.ServeHandler,
  path: string,
  init?: RequestInit,
) =>
  handler(new Request(`http://127.0.0.1:3334${path}`, init), serveHandlerInfo);

Deno.test("serves directory documents and keeps comments isolated", async () => {
  const rootPath = await Deno.makeTempDir({ prefix: "sadoku-directory-" });
  try {
    const firstPath = join(rootPath, "a.md");
    const secondPath = join(rootPath, "b.markdown");
    await Deno.writeTextFile(firstPath, "# First\n");
    await Deno.writeTextFile(secondPath, "# Second\n");
    const documents = [
      {
        deleted: false,
        id: 2,
        filePath: firstPath,
        relativePath: "a.md",
        title: "a.md",
      },
      {
        deleted: false,
        id: 7,
        filePath: secondPath,
        relativePath: "b.markdown",
        title: "b.markdown",
      },
    ];
    const session: DirectorySession = {
      rootPath: resolve(rootPath),
      documents,
      documentsById: new Map(
        documents.map((document) => [document.id, document]),
      ),
    };
    await ensureCommentsNotificationDirectory();
    let opened = 0;
    const handler = createDirectoryPreviewHandler(
      session,
      createMemoryStore(),
      {
        onEventStreamOpen: () => opened++,
      },
    );

    const list = await request(handler, "/__sadoku/documents");
    assertEquals(await list.json(), [
      { deleted: false, id: 2, relativePath: "a.md", title: "a.md" },
      {
        deleted: false,
        id: 7,
        relativePath: "b.markdown",
        title: "b.markdown",
      },
    ]);
    const body = await request(handler, "/__sadoku/documents/2");
    const bodyJson = await body.json();
    assertEquals(bodyJson.id, 2);
    assertEquals(bodyJson.relativePath, "a.md");
    assertEquals(bodyJson.markdown, "# First\n");
    assertEquals(typeof bodyJson.fileUrl, "string");

    for (const path of ["/documents/2", "/documents/2/comments"]) {
      const shell = await request(handler, path);
      assertEquals(shell.status, 200);
      assertEquals(
        shell.headers.get("content-type"),
        "text/html; charset=utf-8",
      );
      const html = await shell.text();
      assertEquals(html.includes('id="sadoku-client-root"'), true);
      assertEquals(html.includes('src="/assets/client.js"'), true);
    }

    for (const id of ["0", "-1", "1.5", "missing", "3"]) {
      assertEquals(
        (await request(handler, `/__sadoku/documents/${id}`)).status,
        404,
      );
    }

    const created = await request(handler, "/__sadoku/documents/2/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ startLine: 1, endLine: 1, body: "Review" }),
    });
    assertEquals(created.status, 200);
    const firstComments = await request(
      handler,
      "/__sadoku/documents/2/comments",
    );
    assertEquals((await firstComments.json()).comments.length, 1);
    const secondComments = await request(
      handler,
      "/__sadoku/documents/7/comments",
    );
    assertEquals((await secondComments.json()).comments.length, 0);

    const listEvents = await request(handler, "/__sadoku/events");
    assertEquals(listEvents.status, 200);
    const documentEvents = await request(
      handler,
      "/__sadoku/documents/2/events",
    );
    assertEquals(documentEvents.status, 200);
    await documentEvents.body?.cancel();
    assertEquals(opened, 1);
    await listEvents.body?.cancel();
  } finally {
    await Deno.remove(rootPath, { recursive: true });
  }
});

Deno.test("serves deleted documents from their saved snapshot", async () => {
  const filePath = "/tmp/deleted.md";
  const commentsStore = createMemoryStore();
  await commentsStore.write(filePath, {
    comments: [],
    filePath,
    sourceSnapshot: "# Saved before deletion\n",
  });
  const document = {
    deleted: true,
    filePath,
    id: 9,
    relativePath: "deleted.md",
    title: "deleted.md",
  };
  const documentStore = {
    ensure: () => Promise.reject(new Error("not used")),
    ensureMany: () => Promise.reject(new Error("not used")),
    findByFilePath: () => Promise.resolve(undefined),
    findById: () => Promise.resolve(undefined),
    list: () => Promise.resolve([]),
    readSnapshot: () => Promise.resolve("# Saved before deletion\n"),
  } satisfies DocumentStore;
  const handler = createDirectoryPreviewHandler(
    {
      rootPath: "/tmp",
      documents: [document],
      documentsById: new Map([[document.id, document]]),
    },
    commentsStore,
    {},
    documentStore,
  );

  const response = await request(handler, "/__sadoku/documents/9");
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    deleted: true,
    id: 9,
    markdown: "# Saved before deletion\n",
    relativePath: "deleted.md",
    title: "deleted.md",
  });
  assertEquals(
    (await request(handler, "/__sadoku/documents/9/comments")).status,
    200,
  );
});

Deno.test("serves an empty directory session", async () => {
  const handler = createDirectoryPreviewHandler({
    rootPath: "/tmp/empty",
    documents: [],
    documentsById: new Map(),
  }, createMemoryStore());
  const response = await request(handler, "/__sadoku/documents");
  assertEquals(response.status, 200);
  assertEquals(await response.json(), []);
});

Deno.test("serves database statistics from the configured reader", async () => {
  const expected = {
    commentCount: { bot: 2, human: 5 },
    databaseSize: 4096,
    documentCount: 3,
  };
  const handler = createDirectoryPreviewHandler(
    {
      rootPath: "/tmp/empty",
      documents: [],
      documentsById: new Map(),
    },
    createMemoryStore(),
    {
      statistics: { read: () => Promise.resolve(expected) },
    },
  );

  const response = await request(handler, "/__sadoku/statistics");
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(await response.json(), expected);
  assertEquals(
    (await request(handler, "/__sadoku/statistics", { method: "POST" })).status,
    405,
  );
});
