import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { pathExists } from "./path_exists.ts";

Deno.test("pathExists distinguishes existing and missing paths", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const filePath = join(directory, "document.md");
    await Deno.writeTextFile(filePath, "# Document\n");

    assertEquals(await pathExists(filePath), true);
    assertEquals(await pathExists(join(directory, "missing.md")), false);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});
