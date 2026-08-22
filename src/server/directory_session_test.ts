import { assertEquals } from "@std/assert";
import { createPreviewSession } from "./directory_session.ts";
import type { DocumentStore } from "./usecase/document/mod.ts";

const createDocumentStore = () => {
  const documents = new Map<string, { filePath: string; id: number }>();
  const store: DocumentStore = {
    ensure: (filePath) => {
      let document = documents.get(filePath);
      if (!document) {
        document = { filePath, id: documents.size + 1 };
        documents.set(filePath, document);
      }
      return Promise.resolve(document);
    },
    ensureMany: () => Promise.resolve([]),
    findByFilePath: (filePath) => Promise.resolve(documents.get(filePath)),
    findById: (id) =>
      Promise.resolve([...documents.values()].find((value) => value.id === id)),
    list: () => Promise.resolve([...documents.values()]),
  };
  return { documents, store };
};

Deno.test("remote preview sessions ignore URL query strings when assigning document IDs", async () => {
  const { documents, store } = createDocumentStore();

  const first = await createPreviewSession(
    "https://example.com/docs/readme.md?token=first#section",
    store,
  );
  const second = await createPreviewSession(
    "https://example.com/docs/readme.md?token=second",
    store,
  );

  assertEquals(documents.size, 1);
  assertEquals([...documents.keys()], ["https://example.com/docs/readme.md"]);
  assertEquals(first.documents[0].id, second.documents[0].id);
  assertEquals(
    first.documents[0].filePath,
    "https://example.com/docs/readme.md?token=first#section",
  );
  assertEquals(
    second.documents[0].filePath,
    "https://example.com/docs/readme.md?token=second",
  );
});
