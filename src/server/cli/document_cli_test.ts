import { assertEquals } from "@std/assert";
import type { DocumentStore } from "../usecase/document/mod.ts";
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
  assertEquals(await listRegisteredDocuments(store), documents);
  assertEquals(await inspectDocument(2, store), documents[1]);
});
