import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { listMarkdownFiles } from "../../storage/document/list_markdown_files.ts";

Deno.test("recursively lists regular Markdown files outside excluded directories", async () => {
  const root = await Deno.makeTempDir();
  try {
    for (const name of ["z.MARKDOWN", "a.md", "B.Md", "notes.txt"]) {
      await Deno.writeTextFile(join(root, name), "content");
    }
    await Deno.mkdir(join(root, "nested", "deeper"), { recursive: true });
    await Deno.writeTextFile(join(root, "nested", "guide.md"), "content");
    await Deno.writeTextFile(
      join(root, "nested", "deeper", "reference.MaRkDoWn"),
      "content",
    );
    await Deno.mkdir(join(root, "nested", "deeper", "too-deep"));
    await Deno.writeTextFile(
      join(root, "nested", "deeper", "too-deep", "excluded.md"),
      "content",
    );
    await Deno.writeTextFile(
      join(root, "nested", "deeper", "ignored.txt"),
      "content",
    );
    await Deno.mkdir(join(root, "nested", ".git"));
    await Deno.writeTextFile(
      join(root, "nested", ".git", "private.md"),
      "content",
    );
    await Deno.mkdir(join(root, "nested", "deeper", "node_modules"));
    await Deno.writeTextFile(
      join(root, "nested", "deeper", "node_modules", "package.md"),
      "content",
    );
    await Deno.symlink(join(root, "a.md"), join(root, "linked.md"));
    await Deno.symlink(join(root, "nested"), join(root, "linked-directory"));

    const documents = await listMarkdownFiles(root);

    assertEquals(
      documents,
      [
        "B.Md",
        "a.md",
        "nested/deeper/reference.MaRkDoWn",
        "nested/guide.md",
        "z.MARKDOWN",
      ].map((name) => ({
        absolutePath: join(root, name),
        relativePath: name,
      })),
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("limits the result to 20 Markdown files", async () => {
  const root = await Deno.makeTempDir();
  try {
    for (let index = 0; index < 25; index++) {
      await Deno.writeTextFile(
        join(root, `document-${index.toString().padStart(2, "0")}.md`),
        "content",
      );
    }

    const documents = await listMarkdownFiles(root);

    assertEquals(documents.length, 20);
    assertEquals(
      documents.map((document) => document.relativePath),
      documents.map((document) => document.relativePath).toSorted(),
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("uses configured directory depth and file limits", async () => {
  const root = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(join(root, "root.md"), "content");
    await Deno.mkdir(join(root, "one", "two", "three"), { recursive: true });
    await Deno.writeTextFile(join(root, "one", "one.md"), "content");
    await Deno.writeTextFile(join(root, "one", "two", "two.md"), "content");
    await Deno.writeTextFile(
      join(root, "one", "two", "three", "three.md"),
      "content",
    );

    assertEquals(
      (await listMarkdownFiles(root, { maxDepth: 0, maxFiles: 10 })).map(
        (document) => document.relativePath,
      ),
      ["root.md"],
    );
    assertEquals(
      (await listMarkdownFiles(root, { maxDepth: 3, maxFiles: 2 })).length,
      2,
    );
    assertEquals(
      (await listMarkdownFiles(root, { maxDepth: 3, maxFiles: 10 })).map(
        (document) => document.relativePath,
      ),
      [
        join("one", "one.md"),
        join("one", "two", "three", "three.md"),
        join("one", "two", "two.md"),
        "root.md",
      ],
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("uses configured excluded directory names at every level", async () => {
  const root = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(root, ".git"));
    await Deno.writeTextFile(join(root, ".git", "included.md"), "content");
    await Deno.mkdir(join(root, "nested", "drafts"), { recursive: true });
    await Deno.writeTextFile(
      join(root, "nested", "drafts", "excluded.md"),
      "content",
    );

    assertEquals(
      (await listMarkdownFiles(root, {
        excludedDirectories: ["drafts"],
        maxDepth: 3,
      })).map((document) => document.relativePath),
      [join(".git", "included.md")],
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("returns an empty list for an empty directory", async () => {
  const root = await Deno.makeTempDir();
  try {
    assertEquals(await listMarkdownFiles(root), []);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("rejects missing paths and non-directories", async () => {
  const root = await Deno.makeTempDir();
  try {
    const filePath = join(root, "file.md");
    await Deno.writeTextFile(filePath, "content");
    await assertRejects(() => listMarkdownFiles(join(root, "missing")));
    await assertRejects(() => listMarkdownFiles(filePath));
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
