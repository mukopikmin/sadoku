import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  type StartedPreviewServer,
  startPreviewServer,
} from "../../src/server/server.ts";
import { withTempCommentsDirectory } from "../../src/server/test_helpers.ts";

const stopServer = async (preview: StartedPreviewServer) => {
  await preview.server.shutdown().catch(() => {});
  await preview.server.finished.catch(() => {});
};

Deno.test("directory preview discovers documents once and preserves legacy isolation", async () => {
  await withTempCommentsDirectory(async () => {
    const root = await Deno.makeTempDir({
      prefix: "sadoku-directory-integration-",
    });
    let preview: StartedPreviewServer | undefined;
    try {
      await Deno.writeTextFile(join(root, "b.md"), "# B\n");
      await Deno.writeTextFile(join(root, "a.markdown"), "# A\n");
      await Deno.writeTextFile(join(root, "ignored.txt"), "ignored");
      preview = await startPreviewServer({
        file: root,
        host: "127.0.0.1",
        keepAlive: true,
        port: 0,
      });

      const listResponse = await fetch(
        new URL("/__sadoku/documents", preview.url),
      );
      const documents = await listResponse.json();
      assertEquals(
        documents.map((document: { relativePath: string }) =>
          document.relativePath
        ),
        [
          "a.markdown",
          "b.md",
        ],
      );
      assertEquals("filePath" in documents[0], false);

      await Deno.writeTextFile(join(root, "later.md"), "# Later\n");
      const unchanged = await fetch(
        new URL("/__sadoku/documents", preview.url),
      );
      assertEquals((await unchanged.json()).length, 2);

      assertEquals(
        (await fetch(new URL("/__sadoku/document", preview.url))).status,
        404,
      );
      const documentResponse = await fetch(
        new URL(`/__sadoku/documents/${documents[0].id}`, preview.url),
      );
      assertEquals((await documentResponse.json()).markdown, "# A\n");
    } finally {
      if (preview) await stopServer(preview);
      await Deno.remove(root, { recursive: true });
    }
  });
});
