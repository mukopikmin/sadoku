import { assertEquals } from "@std/assert";
import type { PreviewCommentsDocument } from "./types.ts";
import type { CommentsDependencies, CommentsStore } from "./ports.ts";
import {
  addComment,
  addReply,
  deleteComment,
  deleteReply,
  getComments,
  setCommentResolution,
  updateComment,
  updateReply,
} from "./mod.ts";

const source = { commentSource: "document.md", documentSource: "source.md" };
const createFixture = () => {
  let document: PreviewCommentsDocument = {
    comments: [],
    filePath: source.commentSource,
  };
  const store: CommentsStore = {
    delete: () => Promise.resolve(),
    list: () => Promise.resolve({ entries: [], warnings: [] }),
    read: () => Promise.resolve(structuredClone(document)),
    write: (_path, value) => {
      document = structuredClone(value);
      return Promise.resolve();
    },
  };
  const deps: CommentsDependencies = {
    commentsStore: store,
    readMarkdown: () => Promise.resolve("first\nsecond\nthird"),
    now: () => "2026-08-13T00:00:00.000Z",
  };
  return { deps, document: () => document };
};

Deno.test("comment use cases share validation, identifiers, and persistence", async () => {
  const fixture = createFixture();
  const first = await addComment(fixture.deps, source, {
    startLine: 2,
    endLine: 2,
    body: "  note  ",
  });
  const second = await addComment(fixture.deps, source, {
    startLine: 3,
    endLine: 3,
    body: "next",
  });
  assertEquals([first.id, second.id], [1, 2]);
  assertEquals(first.sourceText, "second");
  assertEquals(fixture.document().sourceSnapshot, "first\nsecond\nthird");

  const replied = await addReply(fixture.deps, source, {
    commentId: 1,
    body: " answer ",
  });
  assertEquals(replied.replies?.[0].body, "answer");
  const updatedReply = await updateReply(fixture.deps, source, {
    commentId: 1,
    replyId: 1,
    body: "fixed",
  });
  assertEquals(updatedReply.replies?.[0].body, "fixed");
  await deleteReply(fixture.deps, source, 1, 1);
  assertEquals(fixture.document().comments[0].replies, []);

  assertEquals(
    (await updateComment(fixture.deps, source, 1, "changed")).body,
    "changed",
  );
  assertEquals(
    (await setCommentResolution(fixture.deps, source, 1, true)).resolved,
    true,
  );
  await deleteComment(fixture.deps, source, 2);
  assertEquals(
    (await getComments(fixture.deps, source)).comments.map((item) => item.id),
    [1],
  );
});

const assertErrorType = async (
  operation: () => Promise<unknown>,
  type: string,
) => {
  try {
    await operation();
    throw new Error("Expected operation to reject.");
  } catch (error) {
    assertEquals((error as { type?: string }).type, type);
  }
};

Deno.test("comment use cases expose discriminated business errors", async () => {
  const { deps } = createFixture();
  await assertErrorType(
    () => addComment(deps, source, { startLine: 0, endLine: 1, body: "x" }),
    "invalid_range",
  );
  await assertErrorType(
    () => addComment(deps, source, { startLine: 1, endLine: 1, body: " " }),
    "body_required",
  );
  await assertErrorType(
    () => addReply(deps, source, { commentId: 99, body: "x" }),
    "comment_not_found",
  );
  await addComment(deps, source, { startLine: 1, endLine: 1, body: "x" });
  await assertErrorType(
    () =>
      addReply(deps, source, { commentId: 1, body: "x", requestReview: true }),
    "review_requires_bot",
  );
  await setCommentResolution(deps, source, 1, true);
  await assertErrorType(
    () =>
      addReply(deps, source, {
        commentId: 1,
        body: "x",
        author: { type: "bot" },
        requestReview: true,
      }),
    "review_on_resolved_comment",
  );
  await assertErrorType(
    () => updateReply(deps, source, { commentId: 1, replyId: 99, body: "x" }),
    "reply_not_found",
  );
});
