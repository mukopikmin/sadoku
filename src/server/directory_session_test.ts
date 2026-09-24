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

Deno.test("pull request sessions register multiple documents with stable IDs", async () => {
  const { documents, store } = createDocumentStore();
  const encoder = new TextEncoder();
  const responses = (sha: string) => (args: readonly string[]) => {
    const value = args.at(-1)!.endsWith("/pulls/9")
      ? { body: "PR description", head: { sha }, title: "PR title" }
      : [
        { filename: "README.md", status: "modified" },
        { filename: "docs/guide.markdown", status: "added" },
      ];
    return Promise.resolve({
      code: 0,
      stderr: new Uint8Array(),
      stdout: encoder.encode(JSON.stringify(value)),
    });
  };
  const input = "https://github.com/octo/repo/pull/9?token=ignored";
  const first = await createPreviewSession(input, store, {}, {
    run: responses("first"),
  });
  const second = await createPreviewSession(input, store, {}, {
    run: responses("second"),
  });

  assertEquals(documents.size, 2);
  assertEquals(
    first.documents.map(({ relativePath, title }) => ({ relativePath, title })),
    [
      { relativePath: "README.md", title: "README.md" },
      { relativePath: "docs/guide.markdown", title: "guide.markdown" },
    ],
  );
  assertEquals(
    first.documents.map((document) => document.id),
    second.documents.map((document) => document.id),
  );
  assertEquals(first.documents[0].filePath.includes("ref=first"), true);
  assertEquals(second.documents[0].filePath.includes("ref=second"), true);
  assertEquals(first.githubPull, {
    owner: "octo",
    repo: "repo",
    pullNumber: 9,
    initialHeadSha: "first",
    headSha: "first",
  });
  assertEquals(
    [...documents.keys()].every((key) =>
      !key.includes("token") && !key.includes("first")
    ),
    true,
  );
  assertEquals(first.pullRequest, {
    description: "PR description",
    number: 9,
    title: "PR title",
    url: "https://github.com/octo/repo/pull/9",
  });
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
