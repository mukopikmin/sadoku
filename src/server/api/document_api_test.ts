import { assertEquals, assertStringIncludes } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { DocumentStore } from "../usecase/document/mod.ts";
import type {
  DirectoryDocument,
  DirectorySession,
} from "../usecase/document/mod.ts";
import type { TagStore } from "../usecase/tag/ports.ts";
import {
  getDirectoryDocumentResponse,
  listDirectoryDocumentsResponse,
} from "./document_api.ts";

const createSession = (
  documents: DirectoryDocument[],
): DirectorySession => ({
  rootPath: "/workspace/docs",
  documents,
  documentsById: new Map(
    documents.map((document) => [document.id, document]),
  ),
});

const unusedDocumentStore = (
  overrides: Partial<DocumentStore> = {},
): DocumentStore => ({
  ensure: () => Promise.reject(new Error("Unexpected ensure.")),
  ensureMany: () => Promise.reject(new Error("Unexpected ensureMany.")),
  findByFilePath: () => Promise.resolve(undefined),
  findById: () => Promise.resolve(undefined),
  list: () => Promise.resolve([]),
  ...overrides,
});

const tagStore = (calls: number[]): TagStore => ({
  list: () => Promise.resolve([]),
  listForDocument: (documentId) => {
    calls.push(documentId);
    return Promise.resolve([{
      backgroundColor: "#123456",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: 4,
      name: "API",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }]);
  },
  rename: () => Promise.resolve({ type: "not_found", message: "unused" }),
  replaceForDocument: () => Promise.resolve([]),
  update: () => Promise.resolve({ type: "not_found", message: "unused" }),
});

Deno.test("document API lists public document metadata and tags", async () => {
  const documents = [{
    deleted: false,
    filePath: "/workspace/docs/guide.md",
    id: 2,
    relativePath: "guide.md",
    title: "guide.md",
  }, {
    deleted: true,
    filePath: "/workspace/docs/removed.md",
    id: 7,
    relativePath: "removed.md",
    title: "removed.md",
  }];
  const tagCalls: number[] = [];
  const response = await listDirectoryDocumentsResponse(
    createSession(documents),
    tagStore(tagCalls),
  );

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(await response.json(), [
    {
      deleted: false,
      id: 2,
      relativePath: "guide.md",
      tags: [{ backgroundColor: "#123456", id: 4, name: "API" }],
      title: "guide.md",
    },
    {
      deleted: true,
      id: 7,
      relativePath: "removed.md",
      tags: [{ backgroundColor: "#123456", id: 4, name: "API" }],
      title: "removed.md",
    },
  ]);
  assertEquals(tagCalls, [2, 7]);
});

Deno.test("document API omits tags when no tag reader is configured", async () => {
  const document = {
    deleted: false,
    filePath: "/workspace/docs/guide.md",
    id: 2,
    relativePath: "guide.md",
    title: "guide.md",
  };
  const response = await listDirectoryDocumentsResponse(
    createSession([document]),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), [{
    deleted: false,
    id: 2,
    relativePath: "guide.md",
    title: "guide.md",
  }]);
});

Deno.test("document API loads live Markdown and initializes its snapshot", async () => {
  const filePath = await Deno.makeTempFile({ suffix: ".md" });
  try {
    await Deno.writeTextFile(filePath, "# Live\n");
    const document = {
      deleted: false,
      filePath,
      id: 3,
      relativePath: "live.md",
      title: "live.md",
    };
    const initialized: Array<{ id: number; markdown: string }> = [];
    const tags: number[] = [];
    const response = await getDirectoryDocumentResponse(
      "3",
      createSession([document]),
      unusedDocumentStore({
        initializeSnapshot: (id, markdown) => {
          initialized.push({ id, markdown });
          return Promise.resolve();
        },
      }),
      tagStore(tags),
    );

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assertEquals(body, {
      deleted: false,
      fileUrl: new URL(`file://${filePath}`).href,
      id: 3,
      markdown: "# Live\n",
      relativePath: "live.md",
      tags: [{ backgroundColor: "#123456", id: 4, name: "API" }],
      title: "live.md",
    });
    assertEquals(fromFileUrl(body.fileUrl), filePath);
    assertEquals(initialized, [{ id: 3, markdown: "# Live\n" }]);
    assertEquals(tags, [3]);
  } finally {
    await Deno.remove(filePath);
  }
});

Deno.test("document API serves deleted documents from saved snapshots", async () => {
  const document = {
    deleted: true,
    filePath: "/workspace/docs/deleted.md",
    id: 9,
    relativePath: "deleted.md",
    title: "deleted.md",
  };
  const response = await getDirectoryDocumentResponse(
    "9",
    createSession([document]),
    unusedDocumentStore({
      readSnapshot: (id) => {
        assertEquals(id, 9);
        return Promise.resolve("# Saved before deletion\n");
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(await response.json(), {
    deleted: true,
    id: 9,
    markdown: "# Saved before deletion\n",
    relativePath: "deleted.md",
    title: "deleted.md",
  });
});

Deno.test("document API maps invalid and missing document IDs to 404", async () => {
  const session = createSession([]);
  for (
    const id of [
      "0",
      "-1",
      "1.5",
      "missing",
      "9007199254740992",
      "3",
    ]
  ) {
    const response = await getDirectoryDocumentResponse(id, session);
    assertEquals(response.status, 404);
    assertEquals(await response.text(), "Document not found.");
  }
});

Deno.test("document API maps missing saved snapshots to 404", async () => {
  const document = {
    deleted: true,
    filePath: "/workspace/docs/deleted.md",
    id: 9,
    relativePath: "deleted.md",
    title: "deleted.md",
  };
  const response = await getDirectoryDocumentResponse(
    "9",
    createSession([document]),
    unusedDocumentStore({
      readSnapshot: () => Promise.resolve(undefined),
    }),
  );

  assertEquals(response.status, 404);
  assertStringIncludes(await response.text(), "Saved Markdown snapshot");
});
