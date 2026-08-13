import { assertEquals } from "@std/assert";
import type { DocumentStore } from "./storage.ts";
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
  };

  const result = await ensureDirectoryDocuments(
    "/workspace/docs",
    documentStore,
    () =>
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
  );

  assertEquals(ensuredPaths, [[
    "/workspace/docs/guide.md",
    "/workspace/docs/notes.markdown",
  ]]);
  assertEquals(result, [
    {
      filePath: "/workspace/docs/guide.md",
      id: 1,
      relativePath: "guide.md",
    },
    {
      filePath: "/workspace/docs/notes.markdown",
      id: 2,
      relativePath: "notes.markdown",
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
  };

  const error = new Deno.errors.NotFound("missing directory");
  try {
    await ensureDirectoryDocuments(
      "/missing",
      documentStore,
      () => Promise.reject(error),
    );
    throw new Error("Expected directory listing to fail.");
  } catch (caught) {
    assertEquals(caught, error);
  }
  assertEquals(ensureManyCalled, false);
});
