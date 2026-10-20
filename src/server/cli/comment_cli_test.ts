import { assertEquals, assertRejects } from "@std/assert";
import { basename, join } from "@std/path";

import {
  addComment,
  inspectComments,
  listCommentFiles,
  removeComments,
  replyToComment,
  resolveComments,
} from "./comment_cli.ts";
import {
  type CommentsStore,
  type CommentsStoreFile,
  getCommentsDirectoryPath,
  getCommentsFilePath,
} from "../storage/comment/storage.ts";
import { createConfiguredCommentsStore } from "../storage/comment/factory.ts";
import type { PreviewCommentsDocument } from "../usecase/comment/types.ts";
import {
  createTempMarkdown,
  removeTempMarkdown,
  withTempCommentsDirectory,
} from "../test_helpers.ts";

const writeCommentsDocument = async (
  filePath: string,
  document: PreviewCommentsDocument,
): Promise<void> => {
  const store = await createConfiguredCommentsStore();
  try {
    await store.write(filePath, document);
  } finally {
    store.close();
  }
};

const createMemoryCommentsStore = (): {
  documents: Map<string, PreviewCommentsDocument>;
  store: CommentsStore;
} => {
  const documents = new Map<string, PreviewCommentsDocument>();
  const cloneDocument = (
    document: PreviewCommentsDocument,
  ): PreviewCommentsDocument => structuredClone(document);
  const latestUpdatedAt = (document: PreviewCommentsDocument) =>
    document.comments.map((comment) => comment.updatedAt).sort().at(-1);

  return {
    documents,
    store: {
      delete: (filePath) => {
        if (!documents.delete(filePath)) {
          return Promise.reject(new Deno.errors.NotFound());
        }
        return Promise.resolve();
      },
      list: () => {
        const entries: CommentsStoreFile[] = [...documents.entries()].map(
          ([filePath, document]) => ({
            commentCount: document.comments.length,
            fileName: `${filePath}.memory`,
            markdownPath: document.filePath,
            openCount:
              document.comments.filter((comment) => comment.resolved !== true)
                .length,
            updatedAt: latestUpdatedAt(document),
          }),
        );
        entries.sort((left, right) =>
          left.fileName.localeCompare(
            right.fileName,
          )
        );
        return Promise.resolve({ entries, warnings: [] });
      },
      read: (filePath) =>
        Promise.resolve(
          cloneDocument(
            documents.get(filePath) ?? {
              comments: [],
              filePath,
            },
          ),
        ),
      write: (filePath, document) => {
        documents.set(filePath, cloneDocument(document));
        return Promise.resolve();
      },
    },
  };
};

Deno.test("lists comment files from the configured comments directory", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await writeCommentsDocument(filePath, {
        comments: [
          {
            body: "First",
            author: { type: "human" },
            createdAt: "2026-06-08T13:00:00.000Z",
            id: 1,
            startLine: 1,
            endLine: 1,
            originalStartLine: 1,
            originalEndLine: 1,
            resolved: false,
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
          {
            body: "Second",
            author: { type: "human" },
            createdAt: "2026-06-08T13:30:00.000Z",
            id: 2,
            startLine: 3,
            endLine: 3,
            originalStartLine: 3,
            originalEndLine: 3,
            resolved: true,
            stale: false,
            updatedAt: "2026-06-08T14:00:00.000Z",
          },
        ],
        filePath,
      });

      assertEquals(await listCommentFiles(), {
        entries: [{
          commentCount: 2,
          fileName: basename(filePath),
          markdownPath: filePath,
          openCount: 1,
          updatedAt: "2026-06-08T14:00:00.000Z",
        }],
        warnings: [],
      });
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("ignores legacy JSON comment files", async () => {
  await withTempCommentsDirectory(async () => {
    await Deno.writeTextFile(
      join(getCommentsDirectoryPath(), "broken.json"),
      "{",
    );

    const result = await listCommentFiles();

    assertEquals(result.entries, []);
    assertEquals(result.warnings, []);
  });
});

Deno.test("resolves selected comments atomically", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await writeCommentsDocument(filePath, {
        comments: [
          {
            body: "First",
            author: { type: "human" },
            createdAt: "2026-06-08T13:00:00.000Z",
            id: 1,
            startLine: 1,
            endLine: 1,
            originalStartLine: 1,
            originalEndLine: 1,
            resolved: false,
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
          {
            body: "Second",
            author: { type: "human" },
            createdAt: "2026-06-08T13:00:00.000Z",
            id: 2,
            startLine: 3,
            endLine: 3,
            originalStartLine: 3,
            originalEndLine: 3,
            resolved: false,
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
        ],
        filePath,
      });

      const resolved = await resolveComments(filePath, ["2"], {
        asBot: true,
      });
      const inspected = await inspectComments(filePath);

      assertEquals(resolved.comments.length, 1);
      assertEquals(resolved.comments[0].id, 2);
      assertEquals(resolved.comments[0].resolved, true);
      assertEquals(typeof resolved.comments[0].resolvedAt, "string");
      assertEquals(resolved.comments[0].resolvedBy, { type: "bot" });
      assertEquals(inspected.comments.map((comment) => comment.id), [
        1,
      ]);

      await assertRejects(
        () => resolveComments(filePath, ["1", "missing"]),
        Error,
        "Comment not found: missing",
      );
      assertEquals(
        (await inspectComments(filePath)).comments.map((comment) => comment.id),
        [1],
      );
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("adds replies to comments", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await writeCommentsDocument(filePath, {
        comments: [{
          body: "Question",
          author: { type: "human" },
          createdAt: "2026-06-08T13:00:00.000Z",
          id: 1,
          startLine: 3,
          endLine: 3,
          originalStartLine: 3,
          originalEndLine: 3,
          resolved: false,
          stale: false,
          updatedAt: "2026-06-08T13:00:00.000Z",
        }],
        filePath,
      });

      const updated = await replyToComment(
        filePath,
        "1",
        "  More context.  ",
      );

      assertEquals(updated.replies?.length, 1);
      assertEquals(updated.replies?.[0].body, "More context.");
      assertEquals(
        updated.replies?.[0].createdAt,
        updated.replies?.[0].updatedAt,
      );
      assertEquals(
        (await inspectComments(filePath)).comments[0].replies?.[0].body,
        "More context.",
      );
      const botReply = await replyToComment(filePath, "1", "Bot reply", {
        asBot: true,
      });
      assertEquals(botReply.replies?.[1].author, { type: "bot" });
      assertEquals(botReply.replies?.[1].reviewRequested, undefined);
      const reviewReply = await replyToComment(filePath, "1", "Review this", {
        asBot: true,
        requestReview: true,
      });
      assertEquals(reviewReply.replies?.[2].reviewRequested, true);
      assertEquals(
        (await inspectComments(filePath)).comments[0].replies?.[2]
          .reviewRequested,
        true,
      );
      await assertRejects(
        () => replyToComment(filePath, "1", "Invalid", { requestReview: true }),
        Error,
        "Review requests require a bot reply.",
      );
      await assertRejects(
        () => replyToComment(filePath, "missing", "Reply"),
        Error,
        "Comment not found: missing",
      );
      await assertRejects(
        () => replyToComment(filePath, "1", " "),
        Error,
        "Reply body is required.",
      );
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("adds bot comments from the CLI", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown("one\ntwo\nthree\n");
    try {
      const comment = await addComment(filePath, 2, 3, "  Automated.  ", {
        asBot: true,
      });
      assertEquals(comment.author, { type: "bot" });
      assertEquals(comment.body, "Automated.");
      assertEquals(comment.sourceText, "two\nthree");
      const inspected = (await inspectComments(filePath)).comments[0];
      assertEquals(inspected.author, { type: "bot" });
      assertEquals(inspected.body, "Automated.");
      await assertRejects(
        () => addComment(filePath, 9, 9, "Invalid"),
        Error,
        "Comment range does not exist.",
      );
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("uses an injected comments store for CLI operations", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    const { documents, store } = createMemoryCommentsStore();
    const options = { commentsStore: store };
    try {
      documents.set(filePath, {
        comments: [{
          body: "Question",
          author: { type: "human" },
          createdAt: "2026-06-08T13:00:00.000Z",
          id: 1,
          endLine: 3,
          startLine: 3,
          originalEndLine: 3,
          originalStartLine: 3,
          resolved: false,
          sourceText: "Body",
          stale: false,
          updatedAt: "2026-06-08T13:00:00.000Z",
        }],
        filePath,
      });

      const inspected = await inspectComments(filePath, options);
      assertEquals(inspected.comments.map((comment) => comment.id), [1]);

      const replied = await replyToComment(
        filePath,
        "1",
        "  Stored elsewhere.  ",
        options,
      );
      assertEquals(replied.replies?.[0].body, "Stored elsewhere.");

      const resolved = await resolveComments(filePath, ["1"], options);
      assertEquals(resolved.comments[0].resolved, true);
      assertEquals(
        (await listCommentFiles(options)).entries[0].openCount,
        0,
      );

      assertEquals(await removeComments(filePath, options), filePath);
      assertEquals(await listCommentFiles(options), {
        entries: [],
        warnings: [],
      });
      assertEquals(
        await Deno.stat(getCommentsFilePath(filePath)).catch((error) => {
          if (error instanceof Deno.errors.NotFound) return undefined;
          throw error;
        }),
        undefined,
      );
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("operates on URL comments by URL without query string or fragment", async () => {
  await withTempCommentsDirectory(async () => {
    const server = Deno.serve(
      { hostname: "127.0.0.1", port: 0, onListen: () => {} },
      (request) => {
        const url = new URL(request.url);
        return new Response(
          `# Remote ${url.searchParams.get("token")}\nBody\n`,
        );
      },
    );
    const baseUrl = `http://127.0.0.1:${server.addr.port}/remote.md`;

    try {
      await writeCommentsDocument(baseUrl, {
        comments: [
          {
            body: "URL comment",
            author: { type: "human" },
            createdAt: "2026-06-08T13:00:00.000Z",
            id: 1,
            endLine: 1,
            originalEndLine: 1,
            originalStartLine: 1,
            startLine: 1,
            resolved: false,
            sourceText: "# Remote a",
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
          {
            body: "Resolve me",
            author: { type: "human" },
            createdAt: "2026-06-08T13:00:00.000Z",
            id: 2,
            endLine: 2,
            originalEndLine: 2,
            originalStartLine: 2,
            startLine: 2,
            resolved: false,
            sourceText: "Body",
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
        ],
        filePath: baseUrl,
      });

      const inspected = await inspectComments(`${baseUrl}?token=a#section`);
      assertEquals(inspected.filePath, baseUrl);
      assertEquals(inspected.comments.length, 2);
      assertEquals(inspected.comments[0].stale, false);

      const replied = await replyToComment(
        `${baseUrl}?token=a`,
        "1",
        "  URL reply.  ",
      );
      assertEquals(replied.replies?.[0].body, "URL reply.");

      const resolved = await resolveComments(`${baseUrl}?token=b`, [
        "2",
      ]);
      assertEquals(resolved.filePath, baseUrl);
      assertEquals(resolved.comments[0].resolved, true);
      assertEquals(
        (await inspectComments(`${baseUrl}?token=a`)).comments.length,
        1,
      );

      assertEquals(await removeComments(`${baseUrl}?token=c`), baseUrl);
      assertEquals((await listCommentFiles()).entries, []);
    } finally {
      await server.shutdown().catch(() => {});
      await server.finished.catch(() => {});
    }
  });
});
