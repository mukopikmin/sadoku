import { assertEquals } from "@std/assert";
import { dirname, join } from "@std/path";

import { handlePreviewDocumentRequest } from "./document.ts";
import { createTempMarkdown, removeTempMarkdown } from "../test_helpers.ts";

Deno.test("returns the current Markdown document without caching", async () => {
  const filePath = await createTempMarkdown("first");
  try {
    const first = await handlePreviewDocumentRequest(filePath);
    await Deno.writeTextFile(filePath, "second");
    const second = await handlePreviewDocumentRequest(filePath);

    assertEquals(first.headers.get("cache-control"), "no-store");
    assertEquals((await first.json()).markdown, "first");
    assertEquals((await second.json()).markdown, "second");
  } finally {
    await removeTempMarkdown(filePath);
  }
});

Deno.test("returns Markdown documents from URLs", async () => {
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: () => {} },
    (request) => {
      const url = new URL(request.url);
      return new Response(`# Remote ${url.searchParams.get("token")}\n`);
    },
  );

  try {
    const url = `http://127.0.0.1:${server.addr.port}/docs/readme.md?token=a`;
    const response = await handlePreviewDocumentRequest(url);
    const document = await response.json();

    assertEquals(response.headers.get("cache-control"), "no-store");
    assertEquals(document.title, "readme.md");
    assertEquals(document.fileUrl, url);
    assertEquals(document.markdown, "# Remote a\n");
  } finally {
    await server.shutdown().catch(() => {});
    await server.finished.catch(() => {});
  }
});

Deno.test("includes configured Markdown font scale in the document API", async () => {
  const previous = new Map([
    ["APPDATA", Deno.env.get("APPDATA")],
    ["HOME", Deno.env.get("HOME")],
    ["XDG_CONFIG_HOME", Deno.env.get("XDG_CONFIG_HOME")],
  ]);
  const root = await Deno.makeTempDir({ prefix: "sadoku-document-config-" });
  const configFilePath = Deno.build.os === "windows"
    ? join(root, "appdata", "sadoku", "config.toml")
    : join(root, "config", "sadoku", "config.toml");
  const filePath = await createTempMarkdown("# Scaled\n");

  Deno.env.set("APPDATA", join(root, "appdata"));
  Deno.env.set("HOME", join(root, "home"));
  Deno.env.set("XDG_CONFIG_HOME", join(root, "config"));

  try {
    await Deno.mkdir(dirname(configFilePath), { recursive: true });
    await Deno.writeTextFile(configFilePath, "markdownFontScale = 1.125\n");

    const response = await handlePreviewDocumentRequest(filePath);
    const document = await response.json();

    assertEquals(document.markdownFontScale, 1.125);
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) {
        Deno.env.delete(name);
      } else {
        Deno.env.set(name, value);
      }
    }
    await removeTempMarkdown(filePath);
    await Deno.remove(root, { recursive: true }).catch(() => {});
  }
});
