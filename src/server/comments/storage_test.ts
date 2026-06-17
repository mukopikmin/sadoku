import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { dirname, join } from "@std/path";

import type { PreviewCommentsDocument } from "./types.ts";
import {
  getCommentsDirectoryPath,
  getCommentsFilePath,
  getLegacyCommentsFilePath,
  readCommentsDocument,
  writeCommentsDocument,
} from "./storage.ts";
import {
  createTempMarkdown,
  removeTempMarkdown,
  withTempCommentsDirectory,
} from "../test_helpers.ts";

type ConfigEnvironmentPaths = {
  configFilePath: string;
  defaultCommentsDirectory: string;
  root: string;
};

const trackedEnvironmentNames = [
  "APPDATA",
  "HOME",
  "MDVIEW_COMMENTS_DIR",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
] as const;

const withConfigEnvironment = async (
  run: (paths: ConfigEnvironmentPaths) => Promise<void>,
): Promise<void> => {
  const previous = new Map(
    trackedEnvironmentNames.map((name) => [name, Deno.env.get(name)]),
  );
  const root = await Deno.makeTempDir({ prefix: "mdview-config-" });
  const appData = join(root, "appdata");
  const configHome = join(root, "config");
  const dataHome = join(root, "data");
  const home = join(root, "home");

  Deno.env.set("APPDATA", appData);
  Deno.env.set("HOME", home);
  Deno.env.delete("MDVIEW_COMMENTS_DIR");
  Deno.env.set("XDG_CONFIG_HOME", configHome);
  Deno.env.set("XDG_DATA_HOME", dataHome);

  const configFilePath = Deno.build.os === "darwin"
    ? join(home, "Library", "Application Support", "mdview", "config.json")
    : Deno.build.os === "windows"
    ? join(appData, "mdview", "config.json")
    : join(configHome, "mdview", "config.json");
  const defaultCommentsDirectory = Deno.build.os === "darwin"
    ? join(home, "Library", "Application Support", "mdview", "comments")
    : Deno.build.os === "windows"
    ? join(appData, "mdview", "comments")
    : join(dataHome, "mdview", "comments");

  try {
    await run({ configFilePath, defaultCommentsDirectory, root });
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) {
        Deno.env.delete(name);
      } else {
        Deno.env.set(name, value);
      }
    }
    await Deno.remove(root, { recursive: true }).catch(() => {});
  }
};

const writeConfig = async (
  configFilePath: string,
  text: string,
): Promise<void> => {
  await Deno.mkdir(dirname(configFilePath), { recursive: true });
  await Deno.writeTextFile(configFilePath, text);
};

Deno.test("uses comments directory from config", async () => {
  await withConfigEnvironment(async ({ configFilePath, root }) => {
    const commentsDirectory = join(root, "configured-comments");
    await writeConfig(
      configFilePath,
      JSON.stringify({ commentsDirectory }),
    );

    assertEquals(getCommentsDirectoryPath(), commentsDirectory);
  });
});

Deno.test("uses MDVIEW_COMMENTS_DIR before config", async () => {
  await withConfigEnvironment(async ({ configFilePath, root }) => {
    const commentsDirectory = join(root, "configured-comments");
    const environmentDirectory = join(root, "environment-comments");
    await writeConfig(
      configFilePath,
      JSON.stringify({ commentsDirectory }),
    );
    Deno.env.set("MDVIEW_COMMENTS_DIR", environmentDirectory);

    assertEquals(getCommentsDirectoryPath(), environmentDirectory);
  });
});

Deno.test("falls back when config is missing or malformed", async () => {
  await withConfigEnvironment(
    async ({ configFilePath, defaultCommentsDirectory }) => {
      assertEquals(getCommentsDirectoryPath(), defaultCommentsDirectory);

      await writeConfig(configFilePath, "{");

      assertEquals(getCommentsDirectoryPath(), defaultCommentsDirectory);
    },
  );
});

Deno.test("rejects invalid comments directory config type", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await writeConfig(
      configFilePath,
      JSON.stringify({ commentsDirectory: 42 }),
    );

    assertThrows(
      () => getCommentsDirectoryPath(),
      Error,
      "commentsDirectory in mdview config must be a string.",
    );
  });
});

Deno.test("returns an empty comments document when storage does not exist", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      assertEquals(await readCommentsDocument(filePath), {
        comments: [],
        filePath,
      });
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("writes formatted comments JSON with a trailing newline", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    const document: PreviewCommentsDocument = {
      comments: [{
        body: "Review this.",
        createdAt: "2026-06-07T00:00:00.000Z",
        id: "comment-1",
        line: 3,
        originalLine: 3,
        resolved: false,
        sourceText: "Body",
        stale: false,
        updatedAt: "2026-06-07T00:00:00.000Z",
      }],
      filePath,
    };

    try {
      await writeCommentsDocument(filePath, document);
      const stored = await Deno.readTextFile(getCommentsFilePath(filePath));

      assertEquals(stored.endsWith("\n"), true);
      assertEquals(JSON.parse(stored), document);
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("filters invalid stored comments and normalizes legacy resolution", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await Deno.writeTextFile(
        getCommentsFilePath(filePath),
        JSON.stringify({
          comments: [
            {
              body: "Legacy comment",
              createdAt: "2026-06-07T00:00:00.000Z",
              id: "comment-1",
              line: 3,
              updatedAt: "2026-06-07T00:00:00.000Z",
            },
            { id: "missing-required-fields" },
            null,
          ],
          filePath: "/untrusted/path.md",
        }),
      );

      const document = await readCommentsDocument(filePath);

      assertEquals(document.filePath, filePath);
      assertEquals(document.comments.length, 1);
      assertEquals(document.comments[0].id, "comment-1");
      assertEquals(document.comments[0].replies, []);
      assertEquals(document.comments[0].resolved, false);
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("treats a stored document without a comments array as empty", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await Deno.writeTextFile(
        getCommentsFilePath(filePath),
        JSON.stringify({ comments: "invalid" }),
      );

      assertEquals(await readCommentsDocument(filePath), {
        comments: [],
        filePath,
      });
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("rejects malformed comments JSON", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await Deno.writeTextFile(getCommentsFilePath(filePath), "{");

      await assertRejects(
        () => readCommentsDocument(filePath),
        SyntaxError,
      );
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("reads legacy comments stored next to the Markdown file", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await Deno.writeTextFile(
        getLegacyCommentsFilePath(filePath),
        JSON.stringify({
          comments: [{
            body: "Legacy comment",
            createdAt: "2026-06-07T00:00:00.000Z",
            id: "comment-1",
            line: 3,
            updatedAt: "2026-06-07T00:00:00.000Z",
          }],
          filePath,
        }),
      );

      const document = await readCommentsDocument(filePath);

      assertEquals(document.comments.length, 1);
      assertEquals(document.comments[0].id, "comment-1");
    } finally {
      await removeTempMarkdown(filePath);
      await Deno.remove(getLegacyCommentsFilePath(filePath)).catch(() => {});
    }
  });
});
