import { assertEquals, assertRejects } from "@std/assert";

import {
  type StartedPreviewServer,
  startPreviewServer,
} from "../../src/server/server.ts";
import { createTempMarkdown, removeTempMarkdown } from "./test_helpers.ts";

const stopServer = async (preview: StartedPreviewServer): Promise<void> => {
  await preview.server.shutdown().catch(() => {});
  await preview.server.finished.catch(() => {});
};

Deno.test("rejects missing files and directories", async () => {
  const directory = await Deno.makeTempDir({ prefix: "mdview-server-" });
  try {
    await assertRejects(
      () =>
        startPreviewServer({
          file: `${directory}/missing.md`,
          host: "127.0.0.1",
          port: 0,
        }),
      Error,
      "Markdown file not found:",
    );
    await assertRejects(
      () =>
        startPreviewServer({
          file: directory,
          host: "127.0.0.1",
          port: 0,
        }),
      Error,
      "Markdown file not found:",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("starts on an ephemeral port and serves the preview document", async () => {
  const filePath = await createTempMarkdown("# Server test\n");
  const preview = await startPreviewServer({
    file: filePath,
    host: "127.0.0.1",
    keepAlive: true,
    port: 0,
  });

  try {
    assertEquals(preview.filePath, filePath);
    assertEquals(preview.url.startsWith("http://127.0.0.1:"), true);

    const response = await fetch(new URL("/__mdview/document", preview.url));
    const document = await response.json();
    assertEquals(response.status, 200);
    assertEquals(document.markdown, "# Server test\n");
  } finally {
    await stopServer(preview);
    await removeTempMarkdown(filePath);
  }
});
