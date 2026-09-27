import { assertEquals, assertRejects } from "@std/assert";
import {
  exportComment,
  type ExportCommentDependencies,
  type ExportedComment,
} from "./export_comment.ts";
import type { PreviewComment } from "./types.ts";

const input = {
  commentId: 1,
  createdAt: "created",
  body: "Review this",
  displayedMarkdown: "# Heading\nTarget\nMore target\nFooter\n",
  startLine: 2,
  endLine: 3,
  headSha: "current",
  path: "README.md",
};
const setup = () => {
  let posts = 0;
  const comment: PreviewComment = {
    ...input,
    id: 1,
    author: { type: "human" },
    createdAt: "created",
    updatedAt: "updated",
    originalStartLine: 2,
    originalEndLine: 3,
    resolved: false,
    stale: false,
    replies: [{
      id: 2,
      author: { type: "human" },
      body: "Never export this reply",
      createdAt: "created",
      updatedAt: "updated",
    }],
  };
  const deps: ExportCommentDependencies = {
    readMarkdown: () => Promise.resolve(input.displayedMarkdown),
    readComment: () => Promise.resolve(comment),
    readTarget: () => input,
    key: () => Promise.resolve("unique-key"),
    exporter: {
      readPull: () =>
        Promise.resolve({ id: "PR", headSha: "current", open: true }),
      inspect: () => Promise.resolve({}),
      supportsRange: () => Promise.resolve(true),
      createPending: (_pullId, sent, key) => {
        assertEquals(sent, input);
        assertEquals(key, "unique-key");
        posts++;
        return Promise.resolve({
          url: "https://github.com/o/r/pull/1/files",
          state: "pending",
        });
      },
      addPending: () => {
        throw new Error("Unexpected add");
      },
      updatePending: () => {
        throw new Error("Unexpected update");
      },
    },
  };
  return { deps, comment, posts: () => posts };
};

Deno.test("exports only the parent body and reuses existing GitHub comments", async () => {
  const fixture = setup();
  const posted = await exportComment(fixture.deps, input);
  fixture.deps.exporter.inspect = () =>
    Promise.resolve({
      pending: { id: "REVIEW", headSha: "current" },
      comment: existingComment(),
    });
  assertEquals(await exportComment(fixture.deps, input), posted);
  assertEquals(fixture.posts(), 1);
});

for (
  const scenario of [
    "no target",
    "old preview",
    "changed path",
    "missing",
    "bot",
    "resolved",
    "stale",
    "edited",
    "moved",
    "closed",
    "new head",
    "outside diff",
    "remote failure",
    "changed during check",
  ] as const
) {
  Deno.test(`export refuses ${scenario} without posting`, async () => {
    const { deps, comment, posts } = setup();
    switch (scenario) {
      case "no target":
        deps.readTarget = () => undefined;
        break;
      case "old preview":
        deps.readTarget = () => ({ ...input, headSha: "new" });
        break;
      case "changed path":
        deps.readTarget = () => ({ ...input, path: "renamed.md" });
        break;
      case "missing":
        deps.readComment = () => Promise.resolve(undefined);
        break;
      case "bot":
        comment.author.type = "bot";
        break;
      case "resolved":
        comment.resolved = true;
        break;
      case "stale":
        comment.stale = true;
        break;
      case "edited":
        comment.body = "new body";
        break;
      case "moved":
        comment.startLine = 1;
        break;
      case "closed":
        deps.exporter.readPull = () =>
          Promise.resolve({ id: "PR", headSha: "current", open: false });
        break;
      case "new head":
        deps.exporter.readPull = () =>
          Promise.resolve({ id: "PR", headSha: "new", open: true });
        break;
      case "outside diff":
        deps.exporter.supportsRange = () => Promise.resolve(false);
        break;
      case "remote failure":
        deps.exporter.readPull = () => Promise.reject(new Error("offline"));
        break;
      case "changed during check":
        deps.exporter.supportsRange = () => {
          comment.body = "edited";
          return Promise.resolve(true);
        };
        break;
    }
    // Business errors are discriminated objects, not Error subclasses.
    let rejected = false;
    try {
      await exportComment(deps, input);
    } catch {
      rejected = true;
    }
    assertEquals(rejected, true);
    assertEquals(posts(), 0);
  });
}

Deno.test("does not automatically retry ambiguous GitHub publication failures", async () => {
  const { deps } = setup();
  let attempts = 0;
  deps.exporter.createPending = () => {
    attempts++;
    return Promise.reject(new Error("connection lost"));
  };
  await assertRejects(
    () => exportComment(deps, input),
    Error,
    "connection lost",
  );
  assertEquals(attempts, 1);
});

for (
  const markdown of [
    input.displayedMarkdown.replace("Footer", "Changed footer"),
    input.displayedMarkdown.replace("Target", "Target "),
    input.displayedMarkdown.trimEnd(),
    input.displayedMarkdown.replaceAll("\n", "\r\n"),
  ]
) {
  Deno.test(`export rejects a full-document difference ${JSON.stringify(markdown)}`, async () => {
    const { deps, posts } = setup();
    deps.readMarkdown = () => Promise.resolve(markdown);
    // Even an existing export must not bypass the displayed-document check.
    deps.exporter.inspect = () =>
      Promise.resolve({ comment: existingComment() });
    let error: unknown;
    try {
      await exportComment(deps, input);
    } catch (caught) {
      error = caught;
    }
    assertEquals(error, { type: "export_markdown_changed" });
    assertEquals(posts(), 0);
  });
}

Deno.test("export fails closed when the remote Markdown cannot be read", async () => {
  const { deps, posts } = setup();
  deps.readMarkdown = () => Promise.reject(new Error("Remote unavailable"));
  await assertRejects(
    () => exportComment(deps, input),
    Error,
    "Remote unavailable",
  );
  assertEquals(posts(), 0);
});

const existingComment = (
  overrides: Partial<ExportedComment> = {},
): ExportedComment => ({
  id: "COMMENT",
  reviewId: "REVIEW",
  state: "pending",
  url: "https://github.com/o/r/pull/1/files",
  body: input.body,
  headSha: input.headSha,
  path: input.path,
  startLine: input.startLine,
  endLine: input.endLine,
  ...overrides,
});

Deno.test("adds to a remotely discovered pending review without creating another", async () => {
  const { deps } = setup();
  deps.exporter.inspect = () =>
    Promise.resolve({ pending: { id: "BROWSER_REVIEW", headSha: "current" } });
  let added = 0;
  deps.exporter.addPending = (id, sent, key) => {
    assertEquals(id, "BROWSER_REVIEW");
    assertEquals(sent, input);
    assertEquals(key, "unique-key");
    added++;
    return Promise.resolve({ state: "pending", url: "url" });
  };
  assertEquals(await exportComment(deps, input), {
    state: "pending",
    url: "url",
  });
  assertEquals(added, 1);
});

Deno.test("updates changed pending bodies but leaves submitted comments unchanged", async () => {
  const { deps } = setup();
  const existing = existingComment({ body: "Previous body" });
  deps.exporter.inspect = () =>
    Promise.resolve({
      pending: { id: "REVIEW", headSha: "current" },
      comment: existing,
    });
  let updates = 0;
  deps.exporter.updatePending = (found, sent) => {
    assertEquals(found, existing);
    assertEquals(sent.body, input.body);
    updates++;
    return Promise.resolve({ url: existing.url, state: "pending" });
  };
  await exportComment(deps, input);
  existing.state = "submitted";
  assertEquals(await exportComment(deps, input), {
    url: existing.url,
    state: "submitted",
  });
  assertEquals(updates, 1);
});

for (
  const change of [
    "review head",
    "comment head",
    "position",
    "path",
    "missing review",
    "new PR head",
  ] as const
) {
  Deno.test(`rejects pending update when ${change} changed`, async () => {
    const { deps, posts } = setup();
    const pending = { id: "REVIEW", headSha: "current" };
    const comment = existingComment({ body: "Old body" });
    if (change === "review head") pending.headSha = "old";
    if (change === "comment head") comment.headSha = "old";
    if (change === "position") comment.endLine = 9;
    if (change === "path") comment.path = "different.md";
    if (change === "new PR head") {
      deps.exporter.readPull = () =>
        Promise.resolve({ id: "PR", headSha: "new", open: true });
    }
    deps.exporter.inspect = () =>
      Promise.resolve({
        pending: change === "missing review" ? undefined : pending,
        comment,
      });
    let error: unknown;
    try {
      await exportComment(deps, input);
    } catch (caught) {
      error = caught;
    }
    assertEquals(error, {
      type: change === "new PR head"
        ? "export_out_of_sync"
        : "export_review_out_of_sync",
    });
    assertEquals(posts(), 0);
  });
}
