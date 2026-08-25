import { assertEquals } from "@std/assert";
import { toDocumentRelativePath } from "./relative_path.ts";

Deno.test("normalizes Windows document relative paths for the API", () => {
  assertEquals(
    toDocumentRelativePath("guides\\nested\\example.md", "\\"),
    "guides/nested/example.md",
  );
});

Deno.test("preserves backslashes in POSIX file names", () => {
  assertEquals(
    toDocumentRelativePath("guides/file\\name.md", "/"),
    "guides/file\\name.md",
  );
});
