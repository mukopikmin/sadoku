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
    },
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
      },
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
    }),
    [{
      deleted: true,
      filePath: "/workspace/docs/deleted.md",
      id: 3,
      relativePath: "deleted.md",
      title: "deleted.md",
    }],
  );
});
