import { assertEquals, assertRejects } from "@std/assert";
import { dirname, join } from "@std/path";
import { getConfigFilePath } from "../config.ts";
import { withTempCommentsDirectory } from "../test_helpers.ts";
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

Deno.test("document creation respects configured extensions and reports registration failures", async () => {
  await withTempCommentsDirectory(async () => {
    const root = await Deno.makeTempDir();
    try {
      const configPath = getConfigFilePath()!;
      await Deno.mkdir(dirname(configPath), { recursive: true });
      await Deno.writeTextFile(
        configPath,
        'markdown_extensions = [".mdown"]\n',
      );
      const path = join(root, "notes.mdown");
      assertEquals(await addDocument(path, store, { create: true }), {
        filePath: path,
        id: 3,
      });
      assertEquals(await Deno.readTextFile(path), "");
      await assertRejects(
        () => addDocument(join(root, "invalid.md"), store, { create: true }),
        Error,
        "configured Markdown file extension",
      );
      const failedPath = join(root, "saved.mdown");
      await assertRejects(
        () =>
          addDocument(failedPath, {
            ...store,
            ensure: () => Promise.reject(new Error("Storage unavailable")),
          }, { create: true, title: "Saved" }),
        Error,
        "Run document add without --create",
      );
      assertEquals(await Deno.readTextFile(failedPath), "# Saved\n");
      await assertRejects(
        () =>
          addDocument(join(root, "bad-title.mdown"), store, {
            create: true,
            title: "Two\nlines",
          }),
        Error,
        "single-line title",
      );
      assertEquals(
        (await Array.fromAsync(Deno.readDir(root))).map(({ name }) => name)
          .sort(),
        ["notes.mdown", "saved.mdown"],
      );
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  });
});
