import { assertEquals } from "@std/assert";
import { dirname, join } from "@std/path";
import { readConfig } from "../config.ts";
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

Deno.test("PUT rejects invalid theme values", async () => {
  await withSettings(async () => {
    assertEquals(
      (await updateSettings(request({
        codeWrap: "wrap",
        maxDepth: 2,
        maxFiles: 20,
        theme: "sepia",
      })))
        .status,
      400,
    );
  });
});

Deno.test("PUT rejects extra properties", async () => {
  await withSettings(async () => {
    assertEquals(
      (await updateSettings(
        request({
          codeWrap: "wrap",
          extra: true,
          maxDepth: 2,
          maxFiles: 20,
          theme: "dark",
        }),
      )).status,
      400,
    );
  });
});

Deno.test("PUT rejects invalid directory discovery limits", async () => {
  await withSettings(async () => {
    for (
      const limits of [
        { maxDepth: -1, maxFiles: 20 },
        { maxDepth: 2.5, maxFiles: 20 },
        { maxDepth: 2, maxFiles: 0 },
      ]
    ) {
      assertEquals(
        (await updateSettings(request({
          codeWrap: "wrap",
          ...limits,
          theme: "dark",
        }))).status,
        400,
      );
    }
  });
});

Deno.test("PUT rejects invalid excluded directories", async () => {
  await withSettings(async () => {
    for (
      const excludedDirectories of [
        "vendor",
        ["vendor", "vendor"],
        ["nested/vendor"],
        [".."],
      ]
    ) {
      assertEquals(
        (await updateSettings(request({
          codeWrap: "wrap",
          excludedDirectories,
          maxDepth: 2,
          maxFiles: 20,
          theme: "dark",
        }))).status,
        400,
      );
    }
  });
});

Deno.test("PUT rejects invalid font scales", async () => {
  await withSettings(async () => {
    for (const fontScale of [0.74, 1.51, "1", null]) {
      assertEquals(
        (await updateSettings(request({
          codeWrap: "wrap",
          fontScale,
          maxDepth: 2,
          maxFiles: 20,
          theme: "dark",
        }))).status,
        400,
      );
    }
  });
});
