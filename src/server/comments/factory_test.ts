import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { getCommentsDirectoryPath } from "./storage.ts";
import type { PreviewCommentsDocument } from "./types.ts";
import { createConfiguredCommentsStore } from "./factory.ts";
import { getCommentsNotificationFilePath } from "./notifications.ts";
import { withTempCommentsDirectory } from "../test_helpers.ts";
import { createConfiguredStores } from "../store_factory.ts";

Deno.test("configured comments store uses and closes the default SQLite database", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = "/tmp/factory-test.md";
    const document: PreviewCommentsDocument = {
      comments: [{
        author: { type: "human" },
        body: "Persisted in SQLite",
        createdAt: "2026-07-20T00:00:00.000Z",
        endLine: 1,
        id: 1,
        originalEndLine: 1,
        originalStartLine: 1,
        replies: [],
        resolved: false,
        stale: false,
        startLine: 1,
        updatedAt: "2026-07-20T00:00:00.000Z",
      }],
      filePath,
    };
    const store = await createConfiguredCommentsStore();

    await store.write(filePath, document);
    assertEquals(await store.read(filePath), document);
    assertEquals(
      (await Deno.stat(getCommentsNotificationFilePath(filePath))).isFile,
      true,
    );
    assertEquals(
      (await Deno.stat(join(getCommentsDirectoryPath(), "sadoku.sqlite3")))
        .isFile,
      true,
    );

    store.close();
    await assertRejects(() => store.read(filePath));

    const reopenedStore = await createConfiguredCommentsStore();
    try {
      assertEquals(await reopenedStore.read(filePath), document);
    } finally {
      reopenedStore.close();
    }
  });
});

Deno.test("configured document and comment stores share one closable database", async () => {
  await withTempCommentsDirectory(async () => {
    const stores = await createConfiguredStores();
    const filePath = "/tmp/document-without-comments.md";
    const document = await stores.documents.ensure(filePath);

    assertEquals(await stores.documents.findById(document.id), document);
    await assertRejects(
      () => Deno.stat(getCommentsNotificationFilePath(filePath)),
      Deno.errors.NotFound,
    );

    stores.close();
    stores.close();
    await assertRejects(() => stores.comments.read(filePath));
    await assertRejects(() => stores.documents.findById(document.id));
  });
});
