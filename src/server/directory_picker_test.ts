import { assertEquals, assertRejects } from "@std/assert";
import { join, resolve } from "@std/path";
import { listDirectories } from "./directory_picker.ts";

Deno.test("lists child directories for the browser directory picker", async () => {
  const root = await Deno.makeTempDir({ prefix: "sadoku-picker-" });
  try {
    await Deno.mkdir(join(root, "zeta"));
    await Deno.mkdir(join(root, "alpha"));
    await Deno.writeTextFile(join(root, "ignored.md"), "# Ignored\n");

    const listing = await listDirectories(root);
    assertEquals(listing.path, resolve(root));
    assertEquals(listing.directories, [
      { name: "alpha", path: join(resolve(root), "alpha") },
      { name: "zeta", path: join(resolve(root), "zeta") },
    ]);
    assertEquals(typeof listing.parent, "string");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("rejects non-directory picker paths", async () => {
  const file = await Deno.makeTempFile({ prefix: "sadoku-picker-" });
  try {
    await assertRejects(() => listDirectories(file), Error, "Not a directory");
  } finally {
    await Deno.remove(file);
  }
});
