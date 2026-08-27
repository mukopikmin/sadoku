import { assertEquals } from "@std/assert";
import type { DocumentStore } from "./ports.ts";
import { ensureDirectoryDocuments } from "./ensure_directory_documents.ts";

Deno.test("ensures listed directory documents in listing order", async () => {
  const ensuredPaths: string[][] = [];
  const documentsByPath = new Map<string, number>();
  const documentStore: DocumentStore = {
    ensure: (filePath) => {
      const id = documentsByPath.get(filePath) ?? documentsByPath.size + 1;
      documentsByPath.set(filePath, id);
      return Promise.resolve({ filePath, id });
    },
    ensureMany: async (filePaths) => {
      ensuredPaths.push(filePaths);
      return await Promise.all(filePaths.map(documentStore.ensure));
    },
    findByFilePath: () => Promise.resolve(undefined),
    findById: () => Promise.resolve(undefined),
    list: () => Promise.resolve([]),
  };

  const result = await ensureDirectoryDocuments(
    "/workspace/docs",
    {
      documentStore,
      listMarkdownFiles: () =>
        Promise.resolve([
          {
            absolutePath: "/workspace/docs/guide.md",
            relativePath: "guide.md",
          },
          {
            absolutePath: "/workspace/docs/notes.markdown",
            relativePath: "notes.markdown",
          },
        ]),
      pathExists: () => Promise.resolve(false),
    },
    20,
  );

  assertEquals(ensuredPaths, [[
    "/workspace/docs/guide.md",
    "/workspace/docs/notes.markdown",
  ]]);
  assertEquals(result, [
    {
      deleted: false,
      filePath: "/workspace/docs/guide.md",
      id: 1,
      relativePath: "guide.md",
      title: "guide.md",
    },
    {
      deleted: false,
      filePath: "/workspace/docs/notes.markdown",
      id: 2,
      relativePath: "notes.markdown",
      title: "notes.markdown",
    },
  ]);
});

Deno.test("does not write when listing the directory fails", async () => {
  let ensureManyCalled = false;
  const documentStore: DocumentStore = {
    ensure: () => Promise.reject(new Error("unexpected ensure")),
    ensureMany: () => {
      ensureManyCalled = true;
      return Promise.resolve([]);
    },
    findByFilePath: () => Promise.resolve(undefined),
    findById: () => Promise.resolve(undefined),
    list: () => Promise.resolve([]),
  };

  const error = new Deno.errors.NotFound("missing directory");
  try {
    await ensureDirectoryDocuments(
      "/missing",
      {
        documentStore,
        listMarkdownFiles: () => Promise.reject(error),
        pathExists: () => Promise.resolve(false),
      },
      20,
    );
    throw new Error("Expected directory listing to fail.");
  } catch (caught) {
    assertEquals(caught, error);
  }
  assertEquals(ensureManyCalled, false);
});

Deno.test("includes deleted stored documents only from the selected directory", async () => {
  const documentStore: DocumentStore = {
    ensure: () => Promise.reject(new Error("unexpected ensure")),
    ensureMany: () => Promise.resolve([]),
    findByFilePath: () => Promise.resolve(undefined),
    findById: () => Promise.resolve(undefined),
    list: () =>
      Promise.resolve([
        { id: 3, filePath: "/workspace/docs/deleted.md" },
        { id: 4, filePath: "/workspace/other/private.md" },
        { id: 5, filePath: "http://127.0.0.1:54256/remote.md" },
        { id: 6, filePath: "https://example.com/docs/remote.md" },
      ]),
  };

  assertEquals(
    await ensureDirectoryDocuments("/workspace/docs", {
      documentStore,
      listMarkdownFiles: () => Promise.resolve([]),
      pathExists: () => Promise.resolve(false),
    }, 20),
    [{
      deleted: true,
      filePath: "/workspace/docs/deleted.md",
      id: 3,
      relativePath: "deleted.md",
      title: "deleted.md",
    }],
  );
});

const storedDocumentTestStore = (filePaths: string[]): DocumentStore => ({
  ensure: () => Promise.reject(new Error("unexpected ensure")),
  ensureMany: () => Promise.resolve([]),
  findByFilePath: () => Promise.resolve(undefined),
  findById: () => Promise.resolve(undefined),
  list: () =>
    Promise.resolve(filePaths.map((filePath, index) => ({
      id: index + 1,
      filePath,
    }))),
});

Deno.test("does not mark existing unscanned stored documents as deleted", async () => {
  const storedPaths = [
    "/workspace/docs/after-scan-limit.md",
    "/workspace/docs/too/deep/document.md",
    "/workspace/docs/.git/internal.md",
    "/workspace/docs/node_modules/package.md",
  ];
  const checkedPaths: string[] = [];

  const result = await ensureDirectoryDocuments("/workspace/docs", {
    documentStore: storedDocumentTestStore(storedPaths),
    listMarkdownFiles: () => Promise.resolve([]),
    pathExists: (filePath) => {
      checkedPaths.push(filePath);
      return Promise.resolve(true);
    },
  }, 20);

  assertEquals(checkedPaths, storedPaths);
  assertEquals(result, []);
});

Deno.test("marks only actually removed stored documents as deleted", async () => {
  const existingPath = "/workspace/docs/existing-but-unscanned.md";
  const deletedPath = "/workspace/docs/actually-deleted.md";

  const result = await ensureDirectoryDocuments("/workspace/docs", {
    documentStore: storedDocumentTestStore([existingPath, deletedPath]),
    listMarkdownFiles: () => Promise.resolve([]),
    pathExists: (filePath) => Promise.resolve(filePath === existingPath),
  }, 20);

  assertEquals(result, [{
    deleted: true,
    filePath: deletedPath,
    id: 2,
    relativePath: "actually-deleted.md",
    title: "actually-deleted.md",
  }]);
});

Deno.test("limits current and deleted documents to maxDocuments", async () => {
  const listedPaths = ["a.md", "b.md"].map((relativePath) => ({
    absolutePath: `/workspace/docs/${relativePath}`,
    relativePath,
  }));
  const deletedPaths = Array.from(
    { length: 100 },
    (_, index) => `/workspace/docs/deleted-${index}.md`,
  );
  const documentStore = storedDocumentTestStore(deletedPaths);
  documentStore.ensureMany = (filePaths) =>
    Promise.resolve(filePaths.map((filePath, index) => ({
      id: 101 + index,
      filePath,
    })));

  const result = await ensureDirectoryDocuments("/workspace/docs", {
    documentStore,
    listMarkdownFiles: () => Promise.resolve(listedPaths),
    pathExists: () => Promise.resolve(false),
  }, 3);

  assertEquals(result.length, 3);
  assertEquals(result.filter((document) => document.deleted).length, 1);
});

Deno.test("does not add deleted documents after the scan reaches the limit", async () => {
  let existenceChecks = 0;
  const documentStore = storedDocumentTestStore([
    "/workspace/docs/previously-saved.md",
  ]);
  documentStore.ensureMany = (filePaths) =>
    Promise.resolve(filePaths.map((filePath) => ({ id: 2, filePath })));

  const result = await ensureDirectoryDocuments("/workspace/docs", {
    documentStore,
    listMarkdownFiles: () =>
      Promise.resolve([{
        absolutePath: "/workspace/docs/current.md",
        relativePath: "current.md",
      }]),
    pathExists: () => {
      existenceChecks++;
      return Promise.resolve(false);
    },
  }, 1);

  assertEquals(result.length, 1);
  assertEquals(result[0].deleted, false);
  assertEquals(existenceChecks, 0);
});
