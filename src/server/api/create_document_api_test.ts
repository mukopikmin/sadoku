import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { createDocumentResponse } from "./create_document_api.ts";
import type {
  DirectorySession,
  DocumentStore,
} from "../usecase/document/mod.ts";

const store: DocumentStore = {
  ensure: (filePath) => Promise.resolve({ id: 1, filePath }),
  ensureMany: () => Promise.resolve([]),
  list: () => Promise.resolve([]),
  findById: () => Promise.resolve(undefined),
  findByFilePath: () => Promise.resolve(undefined),
};

Deno.test("creation adapter maps conflicts, validation and unavailable sessions explicitly", async () => {
  const rootPath = await Deno.makeTempDir();
  try {
    const session: DirectorySession = {
      rootPath,
      documents: [],
      documentsById: new Map(),
      canCreateDocuments: true,
    };
    const created = await createDocumentResponse(
      { directory: "", filename: "new", title: "Title" },
      session,
      store,
      true,
    );
    assertEquals(created, {
      id: 1n,
      relativePath: "new.md",
      title: "new.md",
      deleted: false,
      tags: [],
    });
    assertEquals(
      await Deno.readTextFile(join(rootPath, "new.md")),
      "# Title\n",
    );
    for (
      const [filename, ready, status, code] of [
        ["new.md", true, 409, "already_exists"],
        ["../escape.md", true, 400, "invalid_argument"],
        ["next.md", false, 412, "failed_precondition"],
      ] as const
    ) {
      const [result] = await Promise.allSettled([
        createDocumentResponse(
          { directory: "", filename, title: "" },
          session,
          store,
          ready,
        ),
      ]);
      assertEquals(result.status, "rejected");
      if (result.status === "rejected") {
        assertEquals(result.reason.status, status);
        assertEquals(result.reason.code, code);
      }
    }
    session.canCreateDocuments = false;
    const [result] = await Promise.allSettled([
      createDocumentResponse(
        { directory: "", filename: "remote.md", title: "" },
        session,
        store,
        true,
      ),
    ]);
    assertEquals(result.status, "rejected");
    if (result.status === "rejected") assertEquals(result.reason.status, 412);
  } finally {
    await Deno.remove(rootPath, { recursive: true });
  }
});
