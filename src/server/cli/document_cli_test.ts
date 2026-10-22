import { assertEquals, assertRejects } from "@std/assert";
import type {
  DocumentStore,
  DocumentTagReader,
} from "../usecase/document/mod.ts";
import {
  addDocument,
  inspectDocument,
  listRegisteredDocuments,
} from "./document_cli.ts";

const documents = [
  { filePath: "/tmp/a.md", id: 1 },
  { filePath: "https://example.com/readme.md", id: 2 },
];
const store: DocumentStore = {
  ensure: (filePath) => Promise.resolve({ filePath, id: 3 }),
  ensureMany: () => Promise.resolve([]),
  findByFilePath: () => Promise.resolve(undefined),
  findById: (id) => Promise.resolve(documents.find((item) => item.id === id)),
  list: () => Promise.resolve(documents),
};

Deno.test("document CLI registers canonical sources", async () => {
  assertEquals(
    await addDocument("https://example.com/readme.md?token=secret#top", store),
    { filePath: "https://example.com/readme.md", id: 3 },
  );
});

Deno.test("document CLI lists and inspects registered documents", async () => {
  assertEquals(
    await listRegisteredDocuments(store),
    documents.map((document) => ({ ...document, tags: [] })),
  );
  assertEquals(await inspectDocument(2, store), { ...documents[1], tags: [] });
});

Deno.test("document CLI includes public tag fields and preserves empty arrays", async () => {
  const tag = { id: 3, name: "API", backgroundColor: "#123456" };
  const reader: DocumentTagReader = {
    listForDocument: (id) =>
      Promise.resolve(id === 2 ? [{ ...tag, createdAt: "private" }] : []),
  };
  assertEquals(await listRegisteredDocuments(store, reader), [
    { ...documents[0], tags: [] },
    { ...documents[1], tags: [tag] },
  ]);
  assertEquals(await inspectDocument(2, store, reader), {
    ...documents[1],
    tags: [tag],
  });
  await assertRejects(
    () => inspectDocument(99, store, reader),
    Error,
    "Document not found: 99",
  );
});
