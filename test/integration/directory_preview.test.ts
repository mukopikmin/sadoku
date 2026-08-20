import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { listCommentFiles } from "../../src/server/cli/comment_cli.ts";
import {
  type StartedPreviewServer,
  startPreviewServer,
} from "../../src/server/server.ts";
import { withTempCommentsDirectory } from "../../src/server/test_helpers.ts";

const stopServer = async (preview: StartedPreviewServer) => {
  await preview.server.shutdown().catch(() => {});
  await preview.server.finished.catch(() => {});
};

const reserveLoopbackPort = (): number => {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = listener.addr.port;
  listener.close();
  return port;
};

const readEvent = async (
  response: Response,
  timeout = 5_000,
): Promise<string> => {
  const reader = response.body!.getReader();
  try {
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Timed out waiting for SSE event.")),
          timeout,
        )
      ),
    ]);
    return new TextDecoder().decode(result.value);
  } finally {
    await reader.cancel().catch(() => {});
  }
};

Deno.test("directory preview supports the complete HTTP workflow", async () => {
  await withTempCommentsDirectory(async () => {
    const root = await Deno.makeTempDir({
      prefix: "sadoku-directory-integration-",
    });
    let preview: StartedPreviewServer | undefined;
    try {
      const aPath = join(root, "a.markdown");
      await Deno.writeTextFile(join(root, "b.md"), "# B\n");
      await Deno.writeTextFile(aPath, "# A\n");
      await Deno.writeTextFile(join(root, "ignored.txt"), "ignored");
      await Deno.mkdir(join(root, "guides"));
      await Deno.writeTextFile(
        join(root, "guides", "getting-started.md"),
        "# Getting started\n",
      );
      await Deno.mkdir(join(root, "guides", "node_modules"));
      await Deno.writeTextFile(
        join(root, "guides", "node_modules", "excluded.md"),
        "# Excluded\n",
      );
      preview = await startPreviewServer({
        file: root,
        host: "127.0.0.1",
        keepAlive: true,
        port: reserveLoopbackPort(),
      });

      const listResponse = await fetch(
        new URL("/__sadoku/documents", preview.url),
      );
      const documents = await listResponse.json();
      assertEquals(
        documents.map((document: { relativePath: string }) =>
          document.relativePath
        ),
        ["a.markdown", "b.md", join("guides", "getting-started.md")],
      );
      assertEquals("filePath" in documents[0], false);
      const [documentA, documentB, nestedDocument] = documents;

      assertEquals((await listCommentFiles()).entries, []);

      for (
        const [document, markdown] of [
          [documentA, "# A\n"],
          [documentB, "# B\n"],
          [nestedDocument, "# Getting started\n"],
        ] as const
      ) {
        const response = await fetch(
          new URL(`/__sadoku/documents/${document.id}`, preview.url),
        );
        assertEquals(response.status, 200);
        assertEquals((await response.json()).markdown, markdown);
      }

      const createResponse = await fetch(
        new URL(`/__sadoku/documents/${documentA.id}/comments`, preview.url),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ startLine: 1, endLine: 1, body: "Review A" }),
        },
      );
      const comment = await createResponse.json();
      assertEquals(createResponse.status, 200);

      const commentsForB = await fetch(
        new URL(`/__sadoku/documents/${documentB.id}/comments`, preview.url),
      );
      assertEquals((await commentsForB.json()).comments, []);
      assertEquals(
        (await listCommentFiles()).entries.map((entry) => entry.markdownPath),
        [aPath],
      );

      const replyResponse = await fetch(
        new URL(
          `/__sadoku/documents/${documentA.id}/comments/${comment.id}/replies`,
          preview.url,
        ),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: "Reply to A" }),
        },
      );
      assertEquals((await replyResponse.json()).replies[0].body, "Reply to A");

      const resolveUrl = new URL(
        `/__sadoku/documents/${documentA.id}/comments/${comment.id}/resolve`,
        preview.url,
      );
      assertEquals(
        (await (await fetch(resolveUrl, { method: "POST" })).json()).resolved,
        true,
      );
      const reopenUrl = new URL(
        `/__sadoku/documents/${documentA.id}/comments/${comment.id}/reopen`,
        preview.url,
      );
      assertEquals(
        (await (await fetch(reopenUrl, { method: "POST" })).json()).resolved,
        false,
      );

      const documentEvents = await fetch(
        new URL(`/__sadoku/documents/${documentA.id}/events`, preview.url),
      );
      const eventPromise = readEvent(documentEvents);
      await Deno.writeTextFile(aPath, "# A updated\n");
      assertStringIncludes(await eventPromise, '"document"');

      await Deno.writeTextFile(join(root, "later.md"), "# Later\n");
      assertEquals(
        (await (await fetch(new URL("/__sadoku/documents", preview.url)))
          .json()).length,
        3,
      );

      const originalIds = documents.map((document: { id: number }) =>
        document.id
      );
      await stopServer(preview);
      preview = undefined;
      const restarted = await startPreviewServer({
        file: root,
        host: "127.0.0.1",
        keepAlive: true,
        port: reserveLoopbackPort(),
      });
      preview = restarted;
      const restartedDocuments = await (
        await fetch(new URL("/__sadoku/documents", restarted.url))
      ).json();
      assertEquals(
        restartedDocuments.filter((document: { relativePath: string }) =>
          document.relativePath !== "later.md"
        ).map((document: { id: number }) => document.id),
        originalIds,
      );
    } finally {
      if (preview) await stopServer(preview);
      await Deno.remove(root, { recursive: true });
    }
  });
});
