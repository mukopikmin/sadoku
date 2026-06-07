import { assertEquals, assertRejects } from "@std/assert";

import type { PreviewCommentsDocument } from "../../src/server/comment_types.ts";
import {
  getCommentsFilePath,
  readCommentsDocument,
  writeCommentsDocument,
} from "../../src/server/comment_storage.ts";
import { createTempMarkdown, removeTempMarkdown } from "./test_helpers.ts";

Deno.test("returns an empty comments document when storage does not exist", async () => {
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

Deno.test("writes formatted comments JSON with a trailing newline", async () => {
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

Deno.test("filters invalid stored comments and normalizes legacy resolution", async () => {
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
    assertEquals(document.comments[0].resolved, false);
  } finally {
    await removeTempMarkdown(filePath);
  }
});

Deno.test("treats a stored document without a comments array as empty", async () => {
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

Deno.test("rejects malformed comments JSON", async () => {
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
