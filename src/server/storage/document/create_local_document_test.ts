import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { createLocalDocumentCreator } from "./create_local_document.ts";

Deno.test("writes completed files in an existing directory and leaves no staging files", async () => {
  const root = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(root, "guides"));
    const path = await createLocalDocumentCreator(root).create(
      "guides",
      "setup.md",
      "# Setup\n",
    );
    assertEquals(await Deno.readTextFile(path), "# Setup\n");
    const entries = await Array.fromAsync(Deno.readDir(join(root, "guides")));
    assertEquals(entries.map(({ name }) => name), ["setup.md"]);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("never overwrites existing files, folders or concurrent creations", async () => {
  const root = await Deno.makeTempDir();
  try {
    const creator = createLocalDocumentCreator(root);
    await Deno.writeTextFile(join(root, "existing.md"), "Keep me");
    await Deno.mkdir(join(root, "folder.md"));
    for (const name of ["existing.md", "folder.md"]) {
      const [result] = await Promise.allSettled([
        creator.create("", name, "Replacement"),
      ]);
      assertEquals(result.status, "rejected");
      if (result.status === "rejected") {
        assertEquals(result.reason.type, "document_exists");
      }
    }
    assertEquals(await Deno.readTextFile(join(root, "existing.md")), "Keep me");
    const results = await Promise.allSettled([
      creator.create("", "race.md", "First"),
      creator.create("", "race.md", "Second"),
    ]);
    assertEquals(
      results.filter(({ status }) => status === "fulfilled").length,
      1,
    );
    assertEquals(
      results.filter(({ status }) => status === "rejected").length,
      1,
    );
    assertEquals(
      (await Array.fromAsync(Deno.readDir(root))).some(({ name }) =>
        name.startsWith(".sadoku-")
      ),
      false,
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test({
  name:
    "rejects missing directories, root escapes and symbolic-link destinations",
  ignore: Deno.build.os === "windows",
  fn: async () => {
    const root = await Deno.makeTempDir();
    const outside = await Deno.makeTempDir();
    try {
      await Deno.symlink(outside, join(root, "linked"));
      const creator = createLocalDocumentCreator(root);
      for (const directory of ["missing", "../outside", "linked"]) {
        const [result] = await Promise.allSettled([
          creator.create(directory, "unsafe.md", ""),
        ]);
        assertEquals(result.status, "rejected");
        if (result.status === "rejected") {
          assertEquals(result.reason.type, "invalid_document_input");
        }
      }
      await Deno.symlink(join(outside, "target.md"), join(root, "link.md"));
      const [result] = await Promise.allSettled([
        creator.create("", "link.md", ""),
      ]);
      assertEquals(result.status, "rejected");
      assertEquals(await Array.fromAsync(Deno.readDir(outside)), []);
    } finally {
      await Deno.remove(root, { recursive: true });
      await Deno.remove(outside, { recursive: true });
    }
  },
});
