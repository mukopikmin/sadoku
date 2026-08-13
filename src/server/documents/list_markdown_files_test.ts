import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { listMarkdownFiles } from "./list_markdown_files.ts";

Deno.test("lists only regular Markdown files directly in a directory", async () => {
  const root = await Deno.makeTempDir();
  try {
    for (const name of ["z.MARKDOWN", "a.md", "B.Md", "notes.txt"]) {
      await Deno.writeTextFile(join(root, name), "content");
    }
    await Deno.mkdir(join(root, "nested"));
    await Deno.writeTextFile(join(root, "nested", "hidden.md"), "content");
    await Deno.symlink(join(root, "a.md"), join(root, "linked.md"));

    const documents = await listMarkdownFiles(root);

    assertEquals(
      documents,
      ["B.Md", "a.md", "z.MARKDOWN"].map((name) => ({
        absolutePath: join(root, name),
        relativePath: name,
      })),
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
