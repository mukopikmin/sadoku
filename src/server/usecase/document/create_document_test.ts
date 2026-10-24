import { assertEquals } from "@std/assert";
import { createDocument, type CreateDocumentInput } from "./create_document.ts";
import type { DocumentStore } from "./ports.ts";
import type { DirectorySession } from "./types.ts";

const setup = () => {
  const session: DirectorySession = {
    canCreateDocuments: true,
    rootPath: "/docs",
    documents: [],
    documentsById: new Map(),
  };
  const writes: Array<
    { directory: string; filename: string; markdown: string }
  > = [];
  const snapshots = new Map<number, string>();
  const documentStore: DocumentStore = {
    ensure: (filePath) => Promise.resolve({ id: 5, filePath }),
    ensureMany: () => Promise.resolve([]),
    findById: () => Promise.resolve(undefined),
    findByFilePath: () => Promise.resolve(undefined),
    list: () => Promise.resolve([]),
    setTitle: () => Promise.resolve(),
    initializeSnapshot: (id, markdown) => {
      snapshots.set(id, markdown);
      return Promise.resolve();
    },
  };
  const deps = {
    documentStore,
    creator: {
      create: (directory: string, filename: string, markdown: string) => {
        writes.push({ directory, filename, markdown });
        return Promise.resolve(
          `/docs/${directory ? directory + "/" : ""}${filename}`,
        );
      },
    },
    markdownExtensions: [".md", ".markdown"],
  };
  return { session, deps, writes, snapshots };
};

Deno.test("creates a titled Markdown file, registers it and initializes its snapshot", async () => {
  const { session, deps, writes, snapshots } = setup();
  const document = await createDocument(session, {
    directory: "guides/nested",
    filename: " setup ",
    title: " 開発環境のセットアップ ",
  }, deps);
  assertEquals(writes, [{
    directory: "guides/nested",
    filename: "setup.md",
    markdown: "",
  }]);
  assertEquals(document.relativePath, "guides/nested/setup.md");
  assertEquals(document.title, "setup.md");
  assertEquals(document.displayTitle, "開発環境のセットアップ");
  assertEquals(session.documentsById.get(5), document);
  assertEquals(session.documents, [document]);
  assertEquals(snapshots.get(5), "");
});

Deno.test("creates empty documents without a title and revives deleted document IDs", async () => {
  const { session, deps, writes } = setup();
  const deleted = {
    id: 5,
    filePath: "/docs/setup.markdown",
    deleted: true,
    relativePath: "setup.markdown",
    title: "setup.markdown",
  };
  session.documents.push(deleted);
  session.documentsById.set(5, deleted);
  const created = await createDocument(session, {
    directory: "",
    filename: "setup.markdown",
    title: "  ",
  }, deps);
  assertEquals(writes[0].markdown, "");
  assertEquals(session.documents, [created]);
  assertEquals(created.deleted, false);
});

Deno.test("rejects invalid paths, filenames, extensions and multiline titles before writing", async () => {
  const { session, deps, writes } = setup();
  const invalid: Partial<CreateDocumentInput>[] = [
    { filename: "" },
    { filename: "../outside" },
    { filename: "a/b" },
    { filename: "a\\b" },
    { filename: "name.txt" },
    { filename: ".." },
    { filename: "name." },
    { filename: "NUL.md" },
    { filename: "x\u0000.md" },
    { directory: "../other" },
    { directory: "/tmp" },
    { directory: "a/../b" },
    { directory: "C:\\temp" },
    { title: "One\nTwo" },
  ];
  for (const input of invalid) {
    const [result] = await Promise.allSettled([
      createDocument(session, {
        directory: "",
        filename: "valid.md",
        title: "",
        ...input,
      }, deps),
    ]);
    assertEquals(result.status, "rejected", JSON.stringify(input));
    if (result.status === "rejected") {
      assertEquals(result.reason.type, "invalid_document_input");
    }
  }
  assertEquals(writes, []);
  assertEquals(session.documents, []);
});

Deno.test("disallows file creation in sessions without a local directory capability", async () => {
  const { session, deps, writes } = setup();
  session.canCreateDocuments = false;
  const [result] = await Promise.allSettled([
    createDocument(
      session,
      { directory: "", filename: "new.md", title: "" },
      deps,
    ),
  ]);
  assertEquals(result.status, "rejected");
  if (result.status === "rejected") {
    assertEquals(result.reason.type, "creation_unavailable");
  }
  assertEquals(writes, []);
});

Deno.test("reports a saved file accurately if document registration fails", async () => {
  const { session, deps, writes } = setup();
  deps.documentStore.ensure = () =>
    Promise.reject(new Error("Database unavailable"));
  const [result] = await Promise.allSettled([
    createDocument(
      session,
      { directory: "", filename: "saved", title: "" },
      deps,
    ),
  ]);
  assertEquals(result.status, "rejected");
  if (result.status === "rejected") {
    assertEquals(result.reason.type, "document_registration_failed");
  }
  assertEquals(writes.length, 1);
  assertEquals(session.documents, []);
});
