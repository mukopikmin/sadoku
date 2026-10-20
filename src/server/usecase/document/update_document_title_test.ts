import { assertEquals, assertRejects } from "@std/assert";
import { updateDocumentTitle } from "./update_document_title.ts";
import type { DirectoryDocument } from "./types.ts";
import type { DocumentStore } from "./ports.ts";

Deno.test("title validation and failed persistence leave session attributes unchanged", async () => {
  const document: DirectoryDocument = {
    id: 1,
    filePath: "guide.md",
    relativePath: "guide.md",
    title: "guide.md",
    displayTitle: "Original",
    deleted: false,
  };
  let writes = 0;
  const store: DocumentStore = {
    ensure: () => Promise.resolve(document),
    ensureMany: () => Promise.resolve([document]),
    findById: () => Promise.resolve(document),
    findByFilePath: () => Promise.resolve(document),
    list: () => Promise.resolve([document]),
    setTitle: () => {
      writes++;
      return Promise.reject(new Error("Database unavailable"));
    },
  };
  for (const title of ["One\nTwo", "One\rTwo", "One\u0000Two"]) {
    const [result] = await Promise.allSettled([
      updateDocumentTitle(document, title, store),
    ]);
    assertEquals(result.status, "rejected");
    if (result.status === "rejected") {
      assertEquals(result.reason.type, "invalid_document_title");
    }
  }
  assertEquals(writes, 0);
  await assertRejects(
    () => updateDocumentTitle(document, "Changed", store),
    Error,
    "Database unavailable",
  );
  assertEquals(document.displayTitle, "Original");
});
