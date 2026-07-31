import { assertEquals } from "@std/assert";

import type { PreviewComment, PreviewCommentsDocument } from "./types.ts";
import type { CommentsStore } from "./storage.ts";
import {
  getLineRangeText,
  getLineText,
  hashSourceText,
  readResolvedCommentsDocument,
  resolveCommentPosition,
} from "./position.ts";

const createComment = (
  overrides: Partial<PreviewComment> = {},
): PreviewComment => ({
  body: "Review this.",
  author: { type: "human" },
  createdAt: "2026-06-07T00:00:00.000Z",
  id: 1,
  startLine: 3,
  endLine: 3,
  originalStartLine: 3,
  originalEndLine: 3,
  resolved: false,
  sourceHash: hashSourceText("Body"),
  sourceText: "Body",
  stale: false,
  updatedAt: "2026-06-07T00:00:00.000Z",
  ...overrides,
});

Deno.test("gets Markdown lines using one-based line numbers", () => {
  assertEquals(getLineText("first\nsecond\n", 1), "first");
  assertEquals(getLineText("first\nsecond\n", 2), "second");
  assertEquals(getLineText("first\nsecond\n", 3), "");
  assertEquals(getLineText("first\nsecond\n", 4), undefined);
  assertEquals(getLineText("first\nsecond\n", 0), undefined);
});

Deno.test("gets Markdown line range text using one-based line numbers", () => {
  assertEquals(getLineRangeText("first\nsecond\nthird", 1, 2), "first\nsecond");
  assertEquals(getLineRangeText("first\nsecond\nthird", 2, 3), "second\nthird");
  assertEquals(getLineRangeText("first\nsecond", 2, 1), undefined);
  assertEquals(getLineRangeText("first\nsecond", 1, 3), undefined);
});

Deno.test("produces stable source hashes", () => {
  assertEquals(hashSourceText("Body"), "428a1095");
  assertEquals(hashSourceText(""), "811c9dc5");
  assertEquals(hashSourceText("Body"), hashSourceText("Body"));
});

Deno.test("keeps a comment at an unchanged source line", () => {
  const resolved = resolveCommentPosition(
    createComment(),
    "# Title\n\nBody\n",
  );

  assertEquals(resolved.displayLine, 3);
  assertEquals(resolved.startLine, 3);
  assertEquals(resolved.originalStartLine, 3);
  assertEquals(resolved.stale, false);
});

Deno.test("tracks a uniquely matching source line within forty lines", () => {
  const before = Array.from({ length: 40 }, (_, index) => `before ${index}`);
  const markdown = [...before, "Body", "after"].join("\n");
  const resolved = resolveCommentPosition(
    createComment({
      startLine: 1,
      endLine: 1,
      originalStartLine: 1,
      originalEndLine: 1,
    }),
    markdown,
  );

  assertEquals(resolved.displayLine, 41);
  assertEquals(resolved.startLine, 41);
  assertEquals(resolved.originalStartLine, 1);
  assertEquals(resolved.stale, false);
});

Deno.test("does not track a matching source line outside the search radius", () => {
  const before = Array.from({ length: 41 }, (_, index) => `before ${index}`);
  const markdown = [...before, "Body"].join("\n");
  const resolved = resolveCommentPosition(
    createComment({
      startLine: 1,
      endLine: 1,
      originalStartLine: 1,
      originalEndLine: 1,
    }),
    markdown,
  );

  assertEquals(resolved.displayLine, 1);
  assertEquals(resolved.startLine, 1);
  assertEquals(resolved.originalStartLine, 1);
  assertEquals(resolved.stale, true);
});

Deno.test("marks a comment stale when its source is ambiguous", () => {
  const resolved = resolveCommentPosition(
    createComment(),
    "# Title\nBody\nchanged\nBody\n",
  );

  assertEquals(resolved.displayLine, 3);
  assertEquals(resolved.startLine, 3);
  assertEquals(resolved.originalStartLine, 3);
  assertEquals(resolved.stale, true);
});

Deno.test("fills source metadata for legacy comments", () => {
  const resolved = resolveCommentPosition(
    createComment({ sourceHash: undefined, sourceText: undefined }),
    "# Title\n\nBody\n",
  );

  assertEquals(resolved.displayLine, 3);
  assertEquals(resolved.sourceText, "Body");
  assertEquals(resolved.sourceHash, hashSourceText("Body"));
  assertEquals(resolved.stale, false);
});

Deno.test("tracks a uniquely matching source range within forty lines", () => {
  const resolved = resolveCommentPosition(
    createComment({
      startLine: 1,
      endLine: 2,
      originalStartLine: 1,
      originalEndLine: 2,
      sourceHash: hashSourceText("alpha\nbeta"),
      sourceText: "alpha\nbeta",
    }),
    "intro\nalpha\nbeta\noutro",
  );

  assertEquals(resolved.startLine, 2);
  assertEquals(resolved.endLine, 3);
  assertEquals(resolved.originalStartLine, 1);
  assertEquals(resolved.originalEndLine, 2);
  assertEquals(resolved.stale, false);
});

Deno.test("marks a source range stale when matching ranges are ambiguous", () => {
  const resolved = resolveCommentPosition(
    createComment({
      startLine: 1,
      endLine: 2,
      originalStartLine: 1,
      originalEndLine: 2,
      sourceHash: hashSourceText("alpha\nbeta"),
      sourceText: "alpha\nbeta",
    }),
    "alpha\nbeta\nchanged\nalpha\nbeta",
  );

  assertEquals(resolved.startLine, 1);
  assertEquals(resolved.endLine, 2);
  assertEquals(resolved.stale, true);
});

Deno.test("rebases comments through edits and marks only deleted lines stale", async () => {
  const filePath = await Deno.makeTempFile({ suffix: ".md" });
  let stored: PreviewCommentsDocument = {
    comments: [createComment()],
    filePath,
    sourceSnapshot: "# Title\n\nBody\n",
  };
  const store: CommentsStore = {
    delete: () => Promise.resolve(),
    list: () => Promise.resolve({ entries: [], warnings: [] }),
    read: () => Promise.resolve(stored),
    write: (_filePath, document) => {
      stored = document;
      return Promise.resolve();
    },
  };

  try {
    await Deno.writeTextFile(filePath, "Intro\n# Title\n\nUpdated body\n");
    const edited = await readResolvedCommentsDocument(
      filePath,
      filePath,
      store,
    );
    assertEquals(edited.comments[0].startLine, 4);
    assertEquals(edited.comments[0].originalStartLine, 3);
    assertEquals(edited.comments[0].stale, false);
    assertEquals(edited.previousSourceSnapshot, "# Title\n\nBody\n");
    assertEquals(edited.sourceSnapshot, "Intro\n# Title\n\nUpdated body\n");

    await Deno.writeTextFile(filePath, "Intro\n# Title\n");
    const deleted = await readResolvedCommentsDocument(
      filePath,
      filePath,
      store,
    );
    assertEquals(deleted.comments[0].stale, true);
  } finally {
    await Deno.remove(filePath);
  }
});

Deno.test("adds display lines when the stored snapshot is unchanged", async () => {
  const filePath = await Deno.makeTempFile({ suffix: ".md" });
  const markdown = "# Title\n\nBody\n";
  const document: PreviewCommentsDocument = {
    comments: [createComment({ displayLine: undefined })],
    filePath,
    sourceSnapshot: markdown,
  };
  const store: CommentsStore = {
    delete: () => Promise.resolve(),
    list: () => Promise.resolve({ entries: [], warnings: [] }),
    read: () => Promise.resolve(document),
    write: () => Promise.reject(new Error("Unexpected write.")),
  };

  try {
    await Deno.writeTextFile(filePath, markdown);
    const resolved = await readResolvedCommentsDocument(
      filePath,
      filePath,
      store,
    );
    assertEquals(resolved.comments[0].displayLine, 3);
  } finally {
    await Deno.remove(filePath);
  }
});
