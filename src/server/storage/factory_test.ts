import { assertEquals, assertRejects } from "@std/assert";
import { getCommentsNotificationFilePath } from "./comment/notifications.ts";
import { createConfiguredStores } from "./factory.ts";
import { withTempCommentsDirectory } from "../test_helpers.ts";

Deno.test("configured stores share one closable database without document notifications", async () => {
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
