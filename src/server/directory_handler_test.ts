import { assertEquals, assertStringIncludes } from "@std/assert";
import { join, resolve } from "@std/path";
import { createDirectoryPreviewHandler } from "./directory_handler.ts";
import type { CommentsStore } from "./storage/comment/storage.ts";
import type { PreviewCommentsDocument } from "./usecase/comment/types.ts";
import type { DirectorySession } from "./usecase/document/mod.ts";
import { serveHandlerInfo } from "./test_helpers.ts";
import { ensureCommentsNotificationDirectory } from "./storage/comment/notifications.ts";
import { previewAssetPaths } from "./preview/asset_manifest.ts";
import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { PreviewService } from "../../gen/ts/sadoku/preview/v1/preview_pb.ts";

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
    const client = createClient(
      PreviewService,
      createConnectTransport({
        baseUrl: "http://127.0.0.1:3334",
        fetch: async (input, init) =>
          await handler(new Request(input, init), serveHandlerInfo),
        useBinaryFormat: false,
      }),
    );
    const listedDocuments = await client.listDocuments({});
    assertEquals(listedDocuments.documents.map(({ id }) => id), [2n, 7n]);
    assertEquals(
      (await client.getDocument({ documentId: 2n })).markdown,
      "# First\n",
    );
    const rpcComment = await client.createComment({
      documentId: 2n,
      startLine: 1,
      endLine: 1,
      body: "RPC review",
    });
    assertEquals(rpcComment.body, "RPC review");
    assertEquals(
      (await client.listComments({ documentId: 2n })).comments.length,
      1,
    );
    await client.deleteComment({ documentId: 2n, commentId: rpcComment.id });

    assertEquals(
      (await request(handler, "/__sadoku/documents")).status,
      200,
    );
    assertEquals(
      (await request(handler, "/__sadoku/documents/2")).status,
      200,
    );

    for (const path of ["/documents/2", "/documents/2/comments"]) {
      const shell = await request(handler, path);
      assertEquals(shell.status, 200);
      assertEquals(
        shell.headers.get("content-type"),
        "text/html; charset=utf-8",
      );
      assertEquals(shell.headers.get("cache-control"), "no-store");
      const html = await shell.text();
      assertEquals(html.includes('id="sadoku-client-root"'), true);
      assertEquals(html.includes(`src="${previewAssetPaths.client}"`), true);
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

  const path = "/sadoku.preview.v1.PreviewService/GetStatistics";
  const response = await request(handler, path, {
    method: "POST",
    headers: {
      "connect-protocol-version": "1",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(await response.json(), {
    commentCount: { bot: "2", human: "5" },
    databaseSize: "4096",
    documentCount: "3",
  });
  assertEquals(
    (await request(handler, path)).status,
    405,
  );
  assertEquals((await request(handler, "/__sadoku/statistics")).status, 404);
});

Deno.test("official Connect client interoperates with preview RPCs", async () => {
  const handler = createDirectoryPreviewHandler(
    {
      rootPath: "/tmp/empty",
      documents: [],
      documentsById: new Map(),
      pullRequest: {
        description: "Description",
        number: 23,
        title: "Improve docs",
        url: "https://github.com/octo/repo/pull/23",
      },
    },
    createMemoryStore(),
    {
      statistics: {
        read: () =>
          Promise.resolve({
            commentCount: { bot: 2, human: 5 },
            databaseSize: 4096,
            documentCount: 3,
          }),
      },
    },
  );
  const transport = createConnectTransport({
    baseUrl: "http://127.0.0.1:3334",
    fetch: async (input, init) =>
      await handler(new Request(input, init), serveHandlerInfo),
    useBinaryFormat: false,
  });
  const client = createClient(PreviewService, transport);

  const session = await client.getSession({});
  assertEquals(session.pullRequest?.number, 23);
  assertEquals(session.pullRequest?.title, "Improve docs");
  const statistics = await client.getStatistics({});
  assertEquals(statistics.commentCount?.bot, 2n);
  assertEquals(statistics.commentCount?.human, 5n);
  assertEquals(statistics.databaseSize, 4096n);
  assertEquals(statistics.documentCount, 3n);
  assertEquals((await request(handler, "/__sadoku/session")).status, 404);
});

Deno.test("statistics RPC reports an unavailable server capability", async () => {
  const handler = createDirectoryPreviewHandler(
    {
      rootPath: "/tmp/empty",
      documents: [],
      documentsById: new Map(),
    },
    createMemoryStore(),
  );
  const response = await request(
    handler,
    "/sadoku.preview.v1.PreviewService/GetStatistics",
    {
      body: "{}",
      headers: {
        "connect-protocol-version": "1",
        "content-type": "application/json",
      },
      method: "POST",
    },
  );
  assertEquals(response.status, 501);
  assertEquals(await response.json(), {
    code: "unimplemented",
    message: "Database statistics are not available.",
  });
});

Deno.test("memory routes expose read and delete operations only", async () => {
  const document = {
    deleted: false,
    id: 1,
    filePath: "/tmp/memory.md",
    relativePath: "memory.md",
    title: "memory.md",
  };
  const session: DirectorySession = {
    rootPath: "/tmp",
    documents: [document],
    documentsById: new Map([[1, document]]),
  };
  let deleted = false;
  const memoryStore = {
    create: () => Promise.reject(new Error("not exposed")),
    delete: (documentId: number, memoryId: number) => {
      deleted = documentId === 1 && memoryId === 2;
      return Promise.resolve(deleted);
    },
    listByDocument: () =>
      Promise.resolve([{
        id: 2,
        documentId: 1,
        content: "Stable context.",
        createdAt: "2026-09-11T00:00:00.000Z",
        updatedAt: "2026-09-11T00:00:00.000Z",
      }]),
    update: () => Promise.resolve(undefined),
  };
  const handler = createDirectoryPreviewHandler(
    session,
    createMemoryStore(),
    {},
    undefined,
    undefined,
    undefined,
    memoryStore,
  );
  const listed = await request(handler, "/__sadoku/documents/1/memories");
  assertEquals(listed.status, 200);
  assertEquals((await listed.json()).memories[0].content, "Stable context.");
  assertEquals(
    (await request(handler, "/__sadoku/documents/1/memories", {
      method: "POST",
    })).status,
    405,
  );
  assertEquals(
    (await request(handler, "/__sadoku/documents/1/memories/2", {
      method: "DELETE",
    })).status,
    204,
  );
  assertEquals(deleted, true);
});

Deno.test("keeps forwarded prefixes request-local while internal routes stay unchanged", async () => {
  const handler = createDirectoryPreviewHandler(
    { rootPath: "/unused", documents: [], documentsById: new Map() },
    createMemoryStore(),
    { trustForwardedPrefix: true },
  );
  await Promise.all(["v1", "staging"].map(async (tag) => {
    const prefix = `/revisions/${tag}`;
    const response = await request(handler, "/documents/7", {
      headers: { "X-Forwarded-Prefix": prefix },
    });
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("Cache-Control"), "no-store");
    const html = await response.text();
    assertStringIncludes(html, `data-base-path="${prefix}"`);
    assertStringIncludes(html, `src="${prefix}${previewAssetPaths.client}"`);
    const asset = await request(handler, previewAssetPaths.client, {
      headers: { "X-Forwarded-Prefix": prefix },
    });
    assertEquals(asset.status, 200);
    assertStringIncludes(asset.headers.get("Content-Type")!, "javascript");
    await asset.body?.cancel();
    const client = createClient(
      PreviewService,
      createConnectTransport({
        baseUrl: "http://127.0.0.1:3334",
        fetch: async (input, init) => {
          const outgoing = new Request(input, init);
          outgoing.headers.set("X-Forwarded-Prefix", prefix);
          return await handler(outgoing, serveHandlerInfo);
        },
        useBinaryFormat: false,
      }),
    );
    await client.getSession({});
  }));
});

Deno.test("ignores untrusted prefixes and rejects malformed trusted prefixes", async () => {
  for (const trustForwardedPrefix of [false, true]) {
    const handler = createDirectoryPreviewHandler(
      { rootPath: "/unused", documents: [], documentsById: new Map() },
      createMemoryStore(),
      { trustForwardedPrefix },
    );
    const response = await request(handler, "/", {
      headers: { "X-Forwarded-Prefix": "//evil.test" },
    });
    assertEquals(response.status, trustForwardedPrefix ? 400 : 200);
    const body = await response.text();
    assertEquals(body.includes("evil.test"), false);
    if (!trustForwardedPrefix) assertStringIncludes(body, 'data-base-path=""');
    if (trustForwardedPrefix) {
      const api = await request(
        handler,
        "/sadoku.preview.v1.PreviewService/GetSession",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-Prefix": "/a/../b",
          },
          body: "{}",
        },
      );
      assertEquals(api.status, 400);
      await api.body?.cancel();
    }
    const root = await request(handler, "/");
    assertEquals(root.status, 200);
    assertStringIncludes(await root.text(), 'data-base-path=""');
  }
});
