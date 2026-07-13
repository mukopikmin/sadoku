import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";

import { readConfig } from "../../src/config.ts";
import { createConfiguredCommentsStore } from "../../src/server/comments/factory.ts";
import { getCommentsFilePath } from "../../src/server/comments/storage.ts";
import { createPreviewHandler } from "../../src/server/mod.ts";
import { withTempCommentsDirectory } from "../../src/server/test_helpers.ts";

const withTempConfigAndCommentsDirectory = async (
  run: (
    paths: { commentsDirectory: string; configFilePath: string },
  ) => Promise<void>,
): Promise<void> => {
  const previous = new Map(
    [
      "APPDATA",
      "HOME",
      "XDG_CONFIG_HOME",
      "XDG_DATA_HOME",
      "SADOKU_COMMENTS_DIR",
      "MDVIEW_COMMENTS_DIR",
    ]
      .map((name) => [name, Deno.env.get(name)]),
  );
  const root = await Deno.makeTempDir({ prefix: "sadoku-sqlite-comments-" });
  const configHome = join(root, "config");
  const commentsDirectory = join(root, "comments");
  const configFilePath = join(configHome, "sadoku", "config.toml");

  Deno.env.set("APPDATA", join(root, "appdata"));
  Deno.env.set("HOME", join(root, "home"));
  Deno.env.set("XDG_CONFIG_HOME", configHome);
  Deno.env.set("XDG_DATA_HOME", join(root, "data"));
  Deno.env.delete("SADOKU_COMMENTS_DIR");
  Deno.env.delete("MDVIEW_COMMENTS_DIR");

  try {
    await Deno.mkdir(join(configHome, "sadoku"), { recursive: true });
    await Deno.writeTextFile(
      configFilePath,
      `commentsDirectory = ${JSON.stringify(commentsDirectory)}

[experimental]
commentsStore = "sqlite"
`,
    );
    await run({ commentsDirectory, configFilePath });
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

Deno.test("stores preview comments in the configured comments directory", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await Deno.makeTempFile({
      prefix: "sadoku-",
      suffix: ".md",
    });
    await Deno.writeTextFile(filePath, "# Title\n\nBody\n");
    try {
      const handler = createPreviewHandler(filePath);

      const emptyResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments"),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const emptyDocument = await emptyResponse.json();
      assertEquals(emptyResponse.status, 200);
      assertEquals(emptyDocument.filePath, filePath);
      assertEquals(emptyDocument.comments, []);

      const createResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            startLine: 3,
            endLine: 3,
            body: "Clarify this.",
          }),
        }),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const createdComment = await createResponse.json();
      assertEquals(createResponse.status, 200);
      assertEquals(createdComment.startLine, 3);
      assertEquals(createdComment.endLine, 3);
      assertEquals(createdComment.body, "Clarify this.");
      assertEquals(createdComment.originalStartLine, 3);
      assertEquals(createdComment.originalEndLine, 3);
      assertEquals(createdComment.replies, []);
      assertEquals(createdComment.resolved, false);
      assertEquals(createdComment.resolvedAt, undefined);
      assertEquals(createdComment.sourceText, "Body");
      assertEquals(createdComment.stale, false);

      const updateResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: "Clarify this paragraph." }),
          },
        ),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const updatedComment = await updateResponse.json();
      assertEquals(updateResponse.status, 200);
      assertEquals(updatedComment.body, "Clarify this paragraph.");

      const deleteResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}`,
          { method: "DELETE" },
        ),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      assertEquals(deleteResponse.status, 204);

      const storedText = await Deno.readTextFile(getCommentsFilePath(filePath));
      const storedDocument = JSON.parse(storedText);
      assertEquals(storedDocument.comments, []);
    } finally {
      await Deno.remove(filePath).catch(() => {});
      await Deno.remove(getCommentsFilePath(filePath)).catch(() => {});
    }
  });
});

Deno.test("preserves preview comment range metadata across reloads", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await Deno.makeTempFile({
      prefix: "mdview-",
      suffix: ".md",
    });
    await Deno.writeTextFile(filePath, "one\ntwo\nthree\nfour\n");
    try {
      const handler = createPreviewHandler(filePath);
      const createResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            startLine: 2,
            endLine: 4,
            body: "Range note.",
          }),
        }),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const createdComment = await createResponse.json();
      assertEquals(createResponse.status, 200);
      assertEquals(createdComment.startLine, 2);
      assertEquals(createdComment.endLine, 4);
      assertEquals(createdComment.originalStartLine, 2);
      assertEquals(createdComment.originalEndLine, 4);
      assertEquals(createdComment.sourceText, "two\nthree\nfour");

      const reloadResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments"),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const reloadedDocument = await reloadResponse.json();
      assertEquals(reloadedDocument.comments[0].endLine, 4);
      assertEquals(reloadedDocument.comments[0].originalEndLine, 4);
      assertEquals(reloadedDocument.comments[0].sourceText, "two\nthree\nfour");

      const storedDocument = JSON.parse(
        await Deno.readTextFile(getCommentsFilePath(filePath)),
      );
      assertEquals(storedDocument.comments[0].endLine, 4);
      assertEquals(storedDocument.comments[0].originalEndLine, 4);
      assertEquals(storedDocument.comments[0].sourceText, "two\nthree\nfour");
    } finally {
      await Deno.remove(filePath).catch(() => {});
      await Deno.remove(getCommentsFilePath(filePath)).catch(() => {});
    }
  });
});

Deno.test("stores replies on preview comments", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await Deno.makeTempFile({
      prefix: "sadoku-",
      suffix: ".md",
    });
    await Deno.writeTextFile(filePath, "# Title\n\nBody\n");
    try {
      const handler = createPreviewHandler(filePath);
      const createResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ startLine: 3, endLine: 3, body: "Question" }),
        }),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const createdComment = await createResponse.json();
      const replyResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}/replies`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: "Answer" }),
          },
        ),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const updatedComment = await replyResponse.json();

      assertEquals(replyResponse.status, 200);
      assertEquals(updatedComment.replies[0].body, "Answer");

      const storedDocument = JSON.parse(
        await Deno.readTextFile(getCommentsFilePath(filePath)),
      );
      assertEquals(storedDocument.comments[0].replies[0].body, "Answer");
    } finally {
      await Deno.remove(filePath).catch(() => {});
      await Deno.remove(getCommentsFilePath(filePath)).catch(() => {});
    }
  });
});

Deno.test("resolves and reopens preview comments", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await Deno.makeTempFile({
      prefix: "sadoku-",
      suffix: ".md",
    });
    await Deno.writeTextFile(filePath, "# Title\n\nBody\n");
    try {
      const handler = createPreviewHandler(filePath);

      const createResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            startLine: 3,
            endLine: 3,
            body: "Clarify this.",
          }),
        }),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const createdComment = await createResponse.json();

      const resolveResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}/resolve`,
          { method: "POST" },
        ),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const resolvedComment = await resolveResponse.json();
      assertEquals(resolveResponse.status, 200);
      assertEquals(resolvedComment.resolved, true);
      assertEquals(typeof resolvedComment.resolvedAt, "string");

      const resolvedDocumentResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments"),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const resolvedDocument = await resolvedDocumentResponse.json();
      assertEquals(resolvedDocument.comments[0].resolved, true);

      const reopenResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}/reopen`,
          { method: "POST" },
        ),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const reopenedComment = await reopenResponse.json();
      assertEquals(reopenResponse.status, 200);
      assertEquals(reopenedComment.resolved, false);
      assertEquals(reopenedComment.resolvedAt, undefined);

      const storedText = await Deno.readTextFile(getCommentsFilePath(filePath));
      const storedDocument = JSON.parse(storedText);
      assertEquals(storedDocument.comments[0].resolved, false);
      assertEquals(storedDocument.comments[0].resolvedAt, undefined);
    } finally {
      await Deno.remove(filePath).catch(() => {});
      await Deno.remove(getCommentsFilePath(filePath)).catch(() => {});
    }
  });
});

Deno.test("tracks preview comments when their source line moves", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await Deno.makeTempFile({
      prefix: "sadoku-",
      suffix: ".md",
    });
    await Deno.writeTextFile(filePath, "# Title\n\nBody\n");
    try {
      const handler = createPreviewHandler(filePath);

      const createResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            startLine: 3,
            endLine: 3,
            body: "Clarify this.",
          }),
        }),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const createdComment = await createResponse.json();

      await Deno.writeTextFile(filePath, "Intro\n# Title\n\nBody\n");
      const movedResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments"),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const movedDocument = await movedResponse.json();
      assertEquals(movedDocument.comments[0].startLine, 4);
      assertEquals(movedDocument.comments[0].originalStartLine, 3);
      assertEquals(movedDocument.comments[0].stale, false);

      const updateResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: "Clarify this paragraph." }),
          },
        ),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const updatedComment = await updateResponse.json();
      assertEquals(updatedComment.startLine, 4);
      assertEquals(updatedComment.originalStartLine, 3);
      assertEquals(updatedComment.stale, false);

      await Deno.writeTextFile(filePath, "Intro\n# Title\n\nChanged\n");
      const staleResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments"),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const staleDocument = await staleResponse.json();
      assertEquals(staleDocument.comments[0].startLine, 3);
      assertEquals(staleDocument.comments[0].originalStartLine, 3);
      assertEquals(staleDocument.comments[0].stale, true);
    } finally {
      await Deno.remove(filePath).catch(() => {});
      await Deno.remove(getCommentsFilePath(filePath)).catch(() => {});
    }
  });
});

Deno.test("stores preview comments in SQLite when configured", async () => {
  await withTempConfigAndCommentsDirectory(async ({ commentsDirectory }) => {
    const filePath = await Deno.makeTempFile({
      prefix: "sadoku-",
      suffix: ".md",
    });
    await Deno.writeTextFile(filePath, "# Title\n\nBody\n");
    try {
      const commentsStore = await createConfiguredCommentsStore(readConfig());
      const persistedStore = await createConfiguredCommentsStore(readConfig());
      try {
        const handler = createPreviewHandler(filePath, { commentsStore });

        const createResponse = await handler(
          new Request("http://127.0.0.1:3334/__sadoku/comments", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ line: 3, body: "Persist me." }),
          }),
          {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
        );
        const createdComment = await createResponse.json();
        assertEquals(createResponse.status, 200);

        const replyResponse = await handler(
          new Request(
            `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}/replies`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ body: "SQLite reply." }),
            },
          ),
          {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
        );
        assertEquals(replyResponse.status, 200);

        const resolveResponse = await handler(
          new Request(
            `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}/resolve`,
            { method: "POST" },
          ),
          {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
        );
        assertEquals(resolveResponse.status, 200);

        const persistedDocument = await persistedStore.read(filePath);
        assertEquals(persistedDocument.comments[0].body, "Persist me.");
        assertEquals(
          persistedDocument.comments[0].replies?.[0]?.body,
          "SQLite reply.",
        );
        assertEquals(persistedDocument.comments[0].resolved, true);

        const deleteResponse = await handler(
          new Request(
            `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}`,
            { method: "DELETE" },
          ),
          {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
        );
        assertEquals(deleteResponse.status, 204);
        assertEquals((await persistedStore.read(filePath)).comments, []);

        await assertRejects(
          () => Deno.stat(getCommentsFilePath(filePath)),
          Deno.errors.NotFound,
        );
        const databaseStat = await Deno.stat(
          join(commentsDirectory, "sadoku.sqlite3"),
        );
        assertEquals(databaseStat.isFile, true);
      } finally {
        commentsStore.close?.();
        persistedStore.close?.();
      }
    } finally {
      await Deno.remove(filePath).catch(() => {});
      await Deno.remove(getCommentsFilePath(filePath)).catch(() => {});
    }
  });
});
