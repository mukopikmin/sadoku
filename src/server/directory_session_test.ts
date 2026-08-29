import { assertEquals } from "@std/assert";
import {
  createLoadingDirectorySession,
  createPreviewSession,
  prepareDirectorySession,
} from "./directory_session.ts";
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

Deno.test("directory preparation becomes ready and publishes counts", async () => {
  const directory = await Deno.makeTempDir();
  await Deno.writeTextFile(`${directory}/one.md`, "# One");
  const { store } = createDocumentStore();
  store.ensureMany = async (paths) =>
    await Promise.all(paths.map((path) => store.ensure(path)));
  const state = createLoadingDirectorySession(directory);
  try {
    await prepareDirectorySession(state, store);
    assertEquals(state.status, { state: "ready", detected: 1, registered: 1 });
    assertEquals(state.session.documents.length, 1);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("directory preparation captures failures", async () => {
  const state = createLoadingDirectorySession("/definitely/missing/sadoku");
  await prepareDirectorySession(state, createDocumentStore().store);
  assertEquals(state.status.state, "error");
  if (state.status.state === "error") {
    assertEquals(state.status.error.name, "NotFound");
  }
});

Deno.test("directory preparation captures cancellation", async () => {
  const controller = new AbortController();
  controller.abort();
  const state = createLoadingDirectorySession(".");
  await prepareDirectorySession(
    state,
    createDocumentStore().store,
    {},
    controller.signal,
  );
  assertEquals(state.status.state, "error");
  if (state.status.state === "error") {
    assertEquals(state.status.error.name, "AbortError");
  }
});
