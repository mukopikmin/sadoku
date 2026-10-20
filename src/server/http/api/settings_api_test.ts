import { assertEquals } from "@std/assert";
import { dirname, join } from "@std/path";
import { readConfig } from "../../config/config.ts";
import { getSettings, updateSettings } from "./settings_api.ts";

const withSettings = async (run: () => Promise<void>) => {
  const previous = Deno.env.get("XDG_CONFIG_HOME");
  const root = await Deno.makeTempDir();
  Deno.env.set("XDG_CONFIG_HOME", root);
  try {
    await run();
  } finally {
    previous === undefined
      ? Deno.env.delete("XDG_CONFIG_HOME")
      : Deno.env.set("XDG_CONFIG_HOME", previous);
    await Deno.remove(root, { recursive: true });
  }
};

const request = (
  body: unknown,
  contentType = "application/json",
): Request =>
  new Request("http://localhost/__sadoku/settings", {
    method: "PUT",
    headers: { "content-type": contentType },
    body: JSON.stringify(
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? {
          excludedDirectories: [".git", "node_modules"],
          fontScale: 1,
          ...body,
        }
        : body,
    ),
  });

Deno.test("GET reads preview settings", async () => {
  await withSettings(async () => {
    const path = join(
      Deno.env.get("XDG_CONFIG_HOME")!,
      "sadoku",
      "config.toml",
    );
    await Deno.mkdir(dirname(path), { recursive: true });
    await Deno.writeTextFile(
      path,
      'theme_mode = "light"\ncode_wrap_mode = "scroll"\ncommentsDirectory = "/tmp/comments"\n',
    );

    const response = getSettings();

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("cache-control"), "no-store");
    assertEquals(await response.json(), {
      codeWrap: "scroll",
      excludedDirectories: [".git", "node_modules"],
      fontScale: 1,
      markdownExtensions: [".md", ".markdown"],
      maxDepth: 2,
      maxFiles: 20,
      theme: "light",
    });
  });
});

Deno.test("PUT updates preview settings without losing config", async () => {
  await withSettings(async () => {
    const path = join(
      Deno.env.get("XDG_CONFIG_HOME")!,
      "sadoku",
      "config.toml",
    );
    await Deno.mkdir(dirname(path), { recursive: true });
    await Deno.writeTextFile(path, 'commentsDirectory = "/tmp/comments"\n');

    const response = await updateSettings(
      request({
        codeWrap: "wrap",
        excludedDirectories: [".git", "vendor"],
        fontScale: 1.2,
        markdownExtensions: [".md", ".mdx"],
        maxDepth: 4,
        maxFiles: 100,
        theme: "dark",
      }),
    );

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      codeWrap: "wrap",
      excludedDirectories: [".git", "vendor"],
      fontScale: 1.2,
      markdownExtensions: [".md", ".mdx"],
      maxDepth: 4,
      maxFiles: 100,
      theme: "dark",
    });
    assertEquals(readConfig(), {
      codeWrapMode: "wrap",
      commentsDirectory: "/tmp/comments",
      directoryMaxDepth: 4,
      directoryMaxFiles: 100,
      excludedDirectories: [".git", "vendor"],
      fontScale: 1.2,
      markdownExtensions: [".md", ".mdx"],
      themeMode: "dark",
    });
  });
});

Deno.test("PUT rejects an invalid Content-Type", async () => {
  await withSettings(async () => {
    assertEquals(
      (await updateSettings(request(
        { codeWrap: "wrap", maxDepth: 2, maxFiles: 20, theme: "dark" },
        "text/plain",
      ))).status,
      400,
    );
  });
});

Deno.test("PUT rejects invalid JSON", async () => {
  await withSettings(async () => {
    const invalidRequest = new Request("http://localhost/__sadoku/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    assertEquals((await updateSettings(invalidRequest)).status, 400);
  });
});

Deno.test("PUT rejects invalid settings", async () => {
  await withSettings(async () => {
    const cases: [string, Record<string, unknown>][] = [
      ["unsupported theme", { theme: "sepia" }],
      ["unknown property", { extra: true }],
      ["negative depth", { maxDepth: -1 }],
      ["fractional depth", { maxDepth: 2.5 }],
      ["zero file limit", { maxFiles: 0 }],
      ["directory list must be an array", { excludedDirectories: "vendor" }],
      ["duplicate directories", { excludedDirectories: ["vendor", "vendor"] }],
      ["nested directory", { excludedDirectories: ["nested/vendor"] }],
      ["parent directory", { excludedDirectories: [".."] }],
      ["empty extensions", { markdownExtensions: [] }],
      ["extension without a dot", { markdownExtensions: ["md"] }],
      ["case-insensitive duplicate extensions", {
        markdownExtensions: [".md", ".MD"],
      }],
      ["nested extension", { markdownExtensions: [".nested/md"] }],
      ["font scale below minimum", { fontScale: 0.74 }],
      ["font scale above maximum", { fontScale: 1.51 }],
      ["string font scale", { fontScale: "1" }],
      ["null font scale", { fontScale: null }],
    ];
    for (const [label, invalid] of cases) {
      const response = await updateSettings(request({
        codeWrap: "wrap",
        maxDepth: 2,
        maxFiles: 20,
        theme: "dark",
        ...invalid,
      }));
      assertEquals(response.status, 400, label);
    }
  });
});
