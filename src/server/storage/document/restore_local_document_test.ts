import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { createLocalDocumentRestorer } from "./restore_local_document.ts";

Deno.test("local restore replaces files, preserves permissions and recreates missing files", async () => {
  const root = await Deno.makeTempDir();
  try {
    const path = join(root, "a.md");
    await Deno.writeTextFile(path, "live");
    if (Deno.build.os !== "windows") await Deno.chmod(path, 0o640);
    const restorer = createLocalDocumentRestorer(root);
    await restorer.replace(path, "", "live");
    assertEquals(await restorer.read(path), "");
    if (Deno.build.os !== "windows") {
      assertEquals((await Deno.stat(path)).mode! & 0o777, 0o640);
    }
    await Deno.remove(path);
    assertEquals(await restorer.read(path), undefined);
    await restorer.replace(path, "restored", undefined);
    assertEquals(await Deno.readTextFile(path), "restored");
    assertEquals(
      Array.from(Deno.readDirSync(root)).map((entry) => entry.name),
      ["a.md"],
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("local restore refuses changed files and paths through symlinks or outside the root", async () => {
  const root = await Deno.makeTempDir();
  const outside = await Deno.makeTempDir();
  try {
    const path = join(root, "a.md");
    const other = join(outside, "other.md");
    await Deno.writeTextFile(path, "new edits");
    await Deno.writeTextFile(other, "untouched");
    const restorer = createLocalDocumentRestorer(root);
    const attempts: [string, string | undefined][] = [[path, "stale"], [
      other,
      "untouched",
    ]];
    if (Deno.build.os !== "windows") {
      await Deno.symlink(other, join(root, "link.md"));
      await Deno.symlink(outside, join(root, "linked-dir"));
      attempts.push([join(root, "link.md"), "untouched"], [
        join(root, "linked-dir/other.md"),
        "untouched",
      ]);
    }
    for (const [destination, expected] of attempts) {
      const [result] = await Promise.allSettled([
        restorer.replace(destination, "replacement", expected),
      ]);
      assertEquals(result.status, "rejected");
      if (result.status === "rejected") {
        assertEquals(
          result.reason.type,
          destination === path ? "restore_conflict" : "restore_unsafe_path",
        );
      }
    }
    assertEquals(await Deno.readTextFile(path), "new edits");
    assertEquals(await Deno.readTextFile(other), "untouched");
    assertEquals(
      Array.from(Deno.readDirSync(root)).some((entry) =>
        entry.name.startsWith(".sadoku-")
      ),
      false,
    );
  } finally {
    await Deno.remove(root, { recursive: true });
    await Deno.remove(outside, { recursive: true });
  }
});
