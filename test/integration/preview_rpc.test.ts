import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { Code, ConnectError, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { PreviewService } from "../../gen/ts/sadoku/preview/v1/preview_pb.ts";
import { openAppDatabase } from "../../src/server/db/connection.ts";
import { createDirectoryPreviewHandler } from "../../src/server/directory_handler.ts";
import type { DirectorySessionState } from "../../src/server/directory_session.ts";
import type { DirectorySession } from "../../src/server/usecase/document/types.ts";
import { createSqliteCommentsStore } from "../../src/server/storage/comment/sqlite_storage.ts";
import { createSqliteDocumentStore } from "../../src/server/storage/document/sqlite_storage.ts";
import { createSqliteMemoryStore } from "../../src/server/storage/memory/sqlite_storage.ts";
import { serveHandlerInfo } from "../../src/server/test_helpers.ts";

const createPreview = async () => {
  const root = await Deno.makeTempDir();
  const database = await openAppDatabase({
    path: join(root, "preview.sqlite3"),
  });
  const documents = createSqliteDocumentStore(database);
  const filePath = join(root, "review.md");
  await Deno.writeTextFile(filePath, "line\nsecond\n");
  const document = {
    ...await documents.ensure(filePath),
    deleted: false,
    relativePath: "review.md",
    title: "Review",
  };
  const session: DirectorySession = {
    rootPath: root,
    documents: [document],
    documentsById: new Map([[document.id, document]]),
  };
  const state: DirectorySessionState = {
    session,
    status: { state: "loading", detected: 0, registered: 0 },
  };
  const comments = createSqliteCommentsStore(database);
  const memories = createSqliteMemoryStore(database);
  let accountAvailable = true;
  const handler = createDirectoryPreviewHandler(
    session,
    comments,
    {
      directoryState: state,
      runGitHubCommand: () =>
        Promise.resolve({
          code: accountAvailable ? 0 : 1,
          stdout: new TextEncoder().encode(
            '{"login":"viewer","name":"","avatar_url":null}',
          ),
          stderr: new TextEncoder().encode("Sign in first."),
        }),
    },
    documents,
    undefined,
    undefined,
    memories,
  );
  const request = async (path: string, init?: RequestInit) =>
    await handler(
      new Request(`http://127.0.0.1:3334${path}`, init),
      serveHandlerInfo,
    );
  const client = createClient(
    PreviewService,
    createConnectTransport({
      baseUrl: "http://127.0.0.1:3334",
      useBinaryFormat: false,
      fetch: async (input, init) => {
        const response = await handler(
          new Request(input, init),
          serveHandlerInfo,
        );
        assertEquals(response.headers.get("cache-control"), "no-store");
        return response;
      },
    }),
  );
  return {
    root,
    database,
    client,
    request,
    session,
    document,
    state,
    comments,
    memories,
    setAccountAvailable: (available: boolean) => {
      accountAvailable = available;
    },
    close: async () => {
      database.close();
      await Deno.remove(root, { recursive: true });
    },
  };
};

Deno.test("Connect exposes one previous revision while retaining all revisions without advancing history on document reads", async () => {
  const preview = await createPreview();
  const { client, document, comments } = preview;
  const documentId = BigInt(document.id);
  try {
    const original = await client.getDocument({ documentId });
    assertEquals(original.previousMarkdown, undefined);
    await client.createComment({
      documentId,
      startLine: 1,
      endLine: 1,
      body: "Review",
    });
    await Deno.writeTextFile(document.filePath, "# Changed\n");
    const before = await comments.read(document.filePath);
    const changed = await client.getDocument({ documentId });
    assertEquals(changed.markdown, "# Changed\n");
    assertEquals(changed.previousMarkdown, original.markdown);
    assertEquals(await comments.read(document.filePath), before);
    await client.listComments({ documentId });
    assertEquals(
      (await client.getDocument({ documentId })).previousMarkdown,
      original.markdown,
    );
    await Deno.writeTextFile(document.filePath, "# Latest\n");
    assertEquals(
      (await client.getDocument({ documentId })).previousMarkdown,
      changed.markdown,
    );
    await client.listComments({ documentId });
    const revisions = (await preview.database.execute(
      "SELECT markdown FROM document_revision ORDER BY id",
    )).rows;
    assertEquals(revisions, [
      { markdown: original.markdown },
      { markdown: changed.markdown },
      { markdown: "# Latest\n" },
    ]);
    await client.getDocument({ documentId });
    await client.listComments({ documentId });
    assertEquals(
      (await preview.database.execute(
        "SELECT markdown FROM document_revision ORDER BY id",
      )).rows,
      revisions,
    );
    document.deleted = true;
    await Deno.remove(document.filePath);
    const deleted = await client.getDocument({ documentId });
    assertEquals(deleted.markdown, "# Latest\n");
    assertEquals(deleted.previousMarkdown, changed.markdown);
  } finally {
    await preview.close();
  }
});

Deno.test("Connect maps document snapshots, status, accounts and memory with REST compatibility", async () => {
  const preview = await createPreview();
  const { client, request, state, document, memories } = preview;
  const documentId = BigInt(document.id);
  try {
    const live = await client.getDocument({ documentId });
    assertEquals(live.markdown, "line\nsecond\n");
    assertEquals(live.title, "Review");
    assertEquals(live.deleted, false);
    assertEquals(live.tags, []);
    assertEquals(live.githubHeadSha, undefined);
    const restDocument = await request(`/__sadoku/documents/${documentId}`);
    assertEquals(restDocument.headers.get("cache-control"), "no-store");
    assertEquals(await restDocument.json(), {
      id: document.id,
      relativePath: "review.md",
      title: "Review",
      deleted: false,
      fileUrl: live.fileUrl,
      markdown: live.markdown,
    });
    document.deleted = true;
    await Deno.remove(document.filePath);
    const snapshot = await client.getDocument({ documentId });
    assertEquals(snapshot.markdown, live.markdown);
    assertEquals(snapshot.deleted, true);
    assertEquals(snapshot.fileUrl, "");
    assertEquals((await client.listDocuments({})).documents[0].deleted, true);
    const loading = await client.getDirectoryStatus({});
    assertEquals([
      loading.state,
      loading.detected,
      loading.registered,
      loading.error,
    ], ["loading", 0n, 0n, undefined]);
    state.status = {
      state: "error",
      detected: 3,
      registered: 1,
      error: { name: "ScanError", message: "Unavailable" },
    };
    const failed = await client.getDirectoryStatus({});
    assertEquals([
      failed.detected,
      failed.registered,
      failed.error?.name,
      failed.error?.message,
    ], [3n, 1n, "ScanError", "Unavailable"]);
    assertEquals(
      await (await request("/__sadoku/directory-status")).json(),
      state.status,
    );
    const account = await client.getGitHubAccount({});
    assertEquals([
      account.ok,
      account.account?.login,
      account.account?.name,
      account.account?.avatarUrl,
      account.message,
    ], [true, "viewer", undefined, undefined, undefined]);
    preview.setAccountAvailable(false);
    const unavailable = await client.getGitHubAccount({});
    assertEquals([unavailable.ok, unavailable.account, unavailable.message], [
      false,
      undefined,
      "Sign in first.",
    ]);
    const memory = await memories.create(
      document.id,
      "Saved context",
      "2026-10-18T00:00:00.000Z",
    );
    const listed = (await client.listMemories({ documentId })).memories;
    assertEquals(
      listed.map(({ id, documentId, content, createdAt, updatedAt }) => ({
        id,
        documentId,
        content,
        createdAt,
        updatedAt,
      })),
      [{
        id: BigInt(memory.id),
        documentId,
        content: memory.content,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      }],
    );
    assertEquals(
      await (await request(`/__sadoku/documents/${documentId}/memories`))
        .json(),
      { memories: [memory] },
    );
    await client.deleteMemory({ documentId, memoryId: BigInt(memory.id) });
    assertEquals((await client.listMemories({ documentId })).memories, []);
    const missing = await assertRejects(
      () => client.deleteMemory({ documentId, memoryId: BigInt(memory.id) }),
      ConnectError,
    );
    assertEquals(missing.code, Code.NotFound);
    for (const id of [0n, 999n, 18446744073709551615n]) {
      const failure = await assertRejects(
        () => client.getDocument({ documentId: id }),
        ConnectError,
      );
      assertEquals(failure.code, Code.NotFound);
      assertEquals(failure.rawMessage, "Document not found.");
    }
  } finally {
    await preview.close();
  }
});

Deno.test("Connect comment mutations retain nested and optional fields across SQLite readback", async () => {
  const preview = await createPreview();
  const { client, document, request } = preview;
  const documentId = BigInt(document.id);
  try {
    const created = await client.createComment({
      documentId,
      startLine: 1,
      endLine: 2,
      body: "  Review  ",
    });
    assertEquals(created.body, "Review");
    assertEquals(created.author?.type, "human");
    assertEquals([
      created.startLine,
      created.endLine,
      created.originalStartLine,
      created.originalEndLine,
    ], [1, 2, 1, 2]);
    assertEquals(created.sourceText, "line\nsecond");
    assertEquals(created.sourceHash?.length, 8);
    assertEquals([
      created.resolved,
      created.stale,
      created.resolvedAt,
      created.resolvedBy,
      created.displayLine,
    ], [false, false, undefined, undefined, undefined]);
    const updated = await client.updateComment({
      documentId,
      commentId: created.id,
      body: "Updated",
    });
    assertEquals(updated.body, "Updated");
    assertEquals(updated.createdAt, created.createdAt);
    const replied = await client.createReply({
      documentId,
      commentId: created.id,
      body: "Reply",
    });
    assertEquals([
      replied.replies[0].id,
      replied.replies[0].author?.type,
      replied.replies[0].body,
    ], [1n, "human", "Reply"]);
    assertEquals(replied.replies[0].reviewRequested, undefined);
    const edited = await client.updateReply({
      documentId,
      commentId: created.id,
      replyId: 1n,
      body: "Edited reply",
    });
    assertEquals(edited.replies[0].body, "Edited reply");
    assertEquals(edited.replies[0].createdAt, replied.replies[0].createdAt);
    const resolved = await client.setCommentResolution({
      documentId,
      commentId: created.id,
      resolved: true,
    });
    assertEquals(resolved.resolved, true);
    assertEquals(resolved.resolvedBy?.type, "human");
    assertEquals(typeof resolved.resolvedAt, "string");
    const listed = await client.listComments({ documentId });
    assertEquals(listed.comments, [{ ...resolved, displayLine: 1 }]);
    assertEquals(listed.filePath, document.filePath);
    assertEquals(listed.githubHeadSha, undefined);
    const rest = await request(`/__sadoku/documents/${documentId}/comments`);
    const restComments = await rest.json();
    assertEquals(restComments.comments[0].id, Number(created.id));
    assertEquals(restComments.comments[0].resolvedBy, { type: "human" });
    assertEquals(restComments.comments[0].replies[0].body, "Edited reply");
    assertEquals("sourceSnapshot" in restComments, false);
    assertEquals("previousSourceSnapshot" in restComments, false);
    // Omitted Proto3 bool means false, so this reopens the comment.
    const reopened = await client.setCommentResolution({
      documentId,
      commentId: created.id,
    });
    assertEquals(
      [reopened.resolved, reopened.resolvedAt, reopened.resolvedBy],
      [false, undefined, undefined],
    );
    await client.deleteReply({
      documentId,
      commentId: created.id,
      replyId: 1n,
    });
    assertEquals(
      (await client.listComments({ documentId })).comments[0].replies,
      [],
    );
    await client.deleteComment({ documentId, commentId: created.id });
    assertEquals((await client.listComments({ documentId })).comments, []);
    const missing = await assertRejects(
      () =>
        client.updateComment({
          documentId,
          commentId: created.id,
          body: "Review",
        }),
      ConnectError,
    );
    assertEquals([missing.code, missing.rawMessage], [
      Code.NotFound,
      "Comment not found.",
    ]);
    for (
      const operation of [
        () => client.updateComment({ documentId, commentId: created.id }),
        () => client.createReply({ documentId, commentId: created.id }),
        () =>
          client.updateReply({
            documentId,
            commentId: created.id,
            replyId: 1n,
          }),
      ]
    ) {
      const blank = await assertRejects(operation, ConnectError);
      assertEquals([blank.code, blank.rawMessage], [
        Code.InvalidArgument,
        "Comment body is required.",
      ]);
    }
    for (
      const [input, message] of [
        [
          { documentId, body: "Review" },
          "Comment startLine must be a positive integer.",
        ],
        [
          { documentId, startLine: 1, body: "Review" },
          "Comment endLine must be a positive integer.",
        ],
        [
          { documentId, startLine: 2, endLine: 1, body: "Review" },
          "Comment endLine must be greater than or equal to startLine.",
        ],
        [{ documentId, startLine: 1, endLine: 1 }, "Comment body is required."],
      ] as const
    ) {
      const failure = await assertRejects(
        () => client.createComment(input),
        ConnectError,
      );
      assertEquals([failure.code, failure.rawMessage], [
        Code.InvalidArgument,
        message,
      ]);
    }
  } finally {
    await preview.close();
  }
});

Deno.test("Connect settings preserve optional absence and validate Proto3 defaults", async () => {
  const preview = await createPreview();
  const previous = Deno.env.get("XDG_CONFIG_HOME");
  Deno.env.set("XDG_CONFIG_HOME", preview.root);
  const { client, request } = preview;
  try {
    const initial = await client.getSettings({});
    assertEquals([
      initial.theme,
      initial.codeWrap,
      initial.fontScale,
      initial.maxDepth,
      initial.maxFiles,
    ], [undefined, undefined, 1, 2, 20]);
    const failure = await assertRejects(
      () => client.updateSettings({}),
      ConnectError,
    );
    assertEquals(failure.code, Code.InvalidArgument);
    const updated = await client.updateSettings({
      theme: "dark",
      codeWrap: "wrap",
      fontScale: 1.25,
      maxDepth: 0,
      maxFiles: 3,
      excludedDirectories: [],
      markdownExtensions: [".md"],
    });
    assertEquals([
      updated.theme,
      updated.codeWrap,
      updated.fontScale,
      updated.maxDepth,
      updated.maxFiles,
      updated.excludedDirectories,
      updated.markdownExtensions,
    ], ["dark", "wrap", 1.25, 0, 3, [], [".md"]]);
    assertEquals(await client.getSettings({}), updated);
    const rest = await request("/__sadoku/settings");
    assertEquals(rest.headers.get("cache-control"), "no-store");
    assertEquals(await rest.json(), {
      theme: "dark",
      codeWrap: "wrap",
      fontScale: 1.25,
      maxDepth: 0,
      maxFiles: 3,
      excludedDirectories: [],
      markdownExtensions: [".md"],
    });
  } finally {
    previous === undefined
      ? Deno.env.delete("XDG_CONFIG_HOME")
      : Deno.env.set("XDG_CONFIG_HOME", previous);
    await preview.close();
  }
});

Deno.test("Connect missing capabilities remain unimplemented before document lookup", async () => {
  const comments = {
    delete: () => Promise.resolve(),
    list: () => Promise.resolve({ entries: [], warnings: [] }),
    read: (filePath: string) => Promise.resolve({ filePath, comments: [] }),
    write: () => Promise.resolve(),
  };
  const handler = createDirectoryPreviewHandler({
    rootPath: "/tmp",
    documents: [],
    documentsById: new Map(),
  }, comments);
  for (
    const method of [
      "GetDirectoryStatus",
      "GetGitHubAccount",
      "ListTags",
      "UpdateTag",
      "DeleteTag",
      "ReplaceDocumentTags",
      "ListInstructions",
      "CreateInstruction",
      "UpdateInstruction",
      "DeleteInstruction",
      "ListMemories",
      "DeleteMemory",
    ]
  ) {
    const response = await handler(
      new Request(
        `http://127.0.0.1:3334/sadoku.preview.v1.PreviewService/${method}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "connect-protocol-version": "1",
          },
          body: "{}",
        },
      ),
      serveHandlerInfo,
    );
    assertEquals(response.status, 501);
    assertEquals(response.headers.get("cache-control"), "no-store");
    assertEquals((await response.json()).code, "unimplemented");
  }
});
