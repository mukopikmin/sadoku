import { assertEquals, assertRejects } from "@std/assert";
import { createGitHubCommentExporter } from "./github_comment.ts";
import type { RunGitHubCommand } from "./github_pull.ts";
import {
  type CommentExportInput,
  exportComment,
} from "./usecase/comment/export_comment.ts";

const pull = {
  owner: "owner",
  repo: "repo",
  pullNumber: 7,
  url: "https://github.com/owner/repo/pull/7",
};
const input: CommentExportInput = {
  headSha: "sha",
  commentId: 1,
  createdAt: "created",
  body: "@secret.txt $(echo unsafe)\n日本語",
  displayedMarkdown:
    "Full document must not be included in the GitHub comment.",
  path: "docs/a b.md",
  startLine: 2,
  endLine: 4,
};
const response = (value: unknown, code = 0) =>
  Promise.resolve({
    code,
    stdout: new TextEncoder().encode(JSON.stringify(value)),
    stderr: new Uint8Array(),
  });
const review = (id = 1, login = "viewer", state = "PENDING") => ({
  id,
  node_id: `R${id}`,
  user: { login },
  state,
  commit_id: "sha",
});
const remoteComment = (
  id = 1,
  reviewId = 1,
  body = "old\n\n<!-- sadoku-comment:key -->",
) => ({
  node_id: `C${id}`,
  body,
  html_url: `${pull.url}#discussion_r${id}`,
  user: { login: "viewer" },
  pull_request_review_id: reviewId,
  commit_id: "sha",
  path: input.path,
  line: 4,
  start_line: 2,
  side: "RIGHT",
  in_reply_to_id: undefined as number | undefined,
});
const fixture = () => {
  const reviews: ReturnType<typeof review>[] = [];
  const comments: ReturnType<typeof remoteComment>[] = [];
  const calls: string[][] = [];
  const mutations: string[] = [];
  let beforeGuard: (() => void) | undefined;
  let failOperation: string | undefined;
  const run: RunGitHubCommand = (args) => {
    calls.push([...args]);
    const endpoint = args.at(-1)!;
    const fields = Object.fromEntries(
      args.filter((arg) => /^[a-zA-Z]+=/.test(arg)).map((arg) => {
        const index = arg.indexOf("=");
        return [arg.slice(0, index), arg.slice(index + 1)];
      }),
    );
    const query = fields.query ?? "";
    const operation = /(?:mutation|query) (\w+)/.exec(query)?.[1];
    if (operation === failOperation && failOperation) {
      return response({ data: {}, errors: [{ message: "Failure" }] });
    }
    const result = (value: unknown) => response({ data: value });
    if (operation === "PendingReview" || operation === "PendingComment") {
      beforeGuard?.();
      const comment = comments.find((item) => item.node_id === fields.id);
      const found = reviews.find((item) =>
        operation === "PendingReview"
          ? item.node_id === fields.id
          : item.id === comment?.pull_request_review_id
      );
      const node = found
        ? {
          id: found.node_id,
          state: found.state,
          author: found.user,
          commit: { oid: found.commit_id },
        }
        : null;
      return result({
        node: operation === "PendingReview"
          ? node
          : comment && node
          ? { body: comment.body, pullRequestReview: node }
          : null,
      });
    }
    if (query.startsWith("mutation")) {
      mutations.push(operation!);
      assertEquals(query.includes("event:"), false);
      assertEquals(query.includes("submitPullRequestReview"), false);
      if (operation === "UpdatePendingComment") {
        const comment = comments.find((item) => item.node_id === fields.id)!;
        comment.body = fields.body;
        return result({
          updatePullRequestReviewComment: {
            pullRequestReviewComment: { id: comment.node_id },
          },
        });
      }
      let target = reviews.find((item) => item.node_id === fields.reviewId);
      if (operation === "CreatePendingReview") {
        if (
          reviews.some((item) =>
            item.state === "PENDING" && item.user.login === "viewer"
          )
        ) return response({}, 1);
        target = review(reviews.length + 1);
        reviews.push(target);
        assertEquals(fields.pullId, "PR");
        assertEquals(fields.sha, "sha");
      }
      if (!target || target.state !== "PENDING") return response({}, 1);
      const comment = remoteComment(
        comments.length + 1,
        target.id,
        fields.body,
      );
      comment.path = fields.path;
      comment.line = Number(fields.line);
      comment.start_line = Number(fields.startLine ?? fields.line);
      comments.push(comment);
      return result(
        operation === "CreatePendingReview"
          ? {
            addPullRequestReview: {
              pullRequestReview: { id: target.node_id, state: "PENDING" },
            },
          }
          : { addPullRequestReviewThread: { thread: { id: "THREAD" } } },
      );
    }
    if (endpoint === "user") return response({ login: "viewer" });
    const page = Number(
      new URL(`https://api.github.com/${endpoint}`).searchParams.get("page") ??
        1,
    );
    const paged = (values: unknown[]) =>
      response(values.slice((page - 1) * 100, page * 100));
    const reviewComments = /\/reviews\/(\d+)\/comments\?/.exec(endpoint);
    if (reviewComments) {
      return paged(
        comments.filter((item) =>
          item.pull_request_review_id === Number(reviewComments[1])
        ),
      );
    }
    if (endpoint.includes("/reviews?")) return paged(reviews);
    if (endpoint.includes("/comments?")) {
      return paged(
        comments.filter((item) =>
          reviews.find((r) => r.id === item.pull_request_review_id)?.state !==
            "PENDING"
        ),
      );
    }
    if (endpoint.includes("/files?")) {
      return response([{
        filename: input.path,
        patch: "@@ -1,4 +1,4 @@\n context\n context\n context\n context",
      }]);
    }
    return response({ node_id: "PR", head: { sha: "sha" }, state: "open" });
  };
  const save = (body = input.body) =>
    exportComment({
      exporter: createGitHubCommentExporter(pull, run),
      readMarkdown: () => Promise.resolve(input.displayedMarkdown),
      readTarget: () => input,
      key: () => Promise.resolve("key"),
      readComment: () =>
        Promise.resolve({
          id: 1,
          body,
          author: { type: "human" },
          startLine: 2,
          endLine: 4,
          originalStartLine: 2,
          originalEndLine: 4,
          createdAt: "created",
          updatedAt: "updated",
          stale: false,
          resolved: false,
        }),
    }, { ...input, body });
  return {
    run,
    reviews,
    comments,
    calls,
    mutations,
    save,
    beforeGuard: (callback: () => void) => {
      beforeGuard = callback;
    },
    fail: (name: string) => {
      failOperation = name;
    },
  };
};

Deno.test("creates a pending review with the first comment, then discovers and updates it after restart", async () => {
  const f = fixture();
  const result = await f.save();
  assertEquals(result, { url: `${pull.url}/files`, state: "pending" });
  assertEquals(f.reviews.length, 1);
  assertEquals(
    f.comments[0].body,
    `${input.body}\n\n<!-- sadoku-comment:key -->`,
  );
  assertEquals(
    f.calls.flat().some((arg) => arg.includes(input.displayedMarkdown)),
    false,
  );
  assertEquals(
    f.calls.flat().includes(
      `body=${input.body}\n\n<!-- sadoku-comment:key -->`,
    ),
    true,
  );
  assertEquals(f.comments[0].line, 4);
  assertEquals(f.comments[0].start_line, 2);
  await f.save();
  assertEquals(f.mutations, ["CreatePendingReview"]);
  await f.save("Edited local body");
  assertEquals(f.mutations, ["CreatePendingReview", "UpdatePendingComment"]);
  assertEquals(f.comments.length, 1);
  assertEquals(
    f.comments[0].body,
    "Edited local body\n\n<!-- sadoku-comment:key -->",
  );
  // Submission happens in GitHub, and subsequent explicit saves do not edit it.
  f.reviews[0].state = "COMMENTED";
  assertEquals(await f.save("Another edit"), {
    url: `${pull.url}#discussion_r1`,
    state: "submitted",
  });
  assertEquals(f.mutations.length, 2);
  // Discard/delete in GitHub removes the remote record. No local review ID lingers.
  f.reviews.length = 0;
  f.comments.length = 0;
  assertEquals((await f.save()).state, "pending");
  assertEquals(f.mutations.at(-1), "CreatePendingReview");
});

Deno.test("reuses the viewer's browser review, leaves other reviewers and manual comments untouched", async () => {
  const f = fixture();
  f.reviews.push(review(1, "other"), review(2));
  f.comments.push(
    { ...remoteComment(1, 1), user: { login: "other" } },
    remoteComment(2, 2, "Browser comment"),
  );
  await f.save();
  assertEquals(f.reviews.length, 2);
  assertEquals(f.comments.length, 3);
  assertEquals(f.comments[2].pull_request_review_id, 2);
  assertEquals(f.comments[1].body, "Browser comment");
  assertEquals(f.mutations, ["AddPendingThread"]);
});

for (const hasPendingReview of [false, true]) {
  Deno.test(`ignores another account's submitted comment with the same marker (pending review: ${hasPendingReview})`, async () => {
    const f = fixture();
    const otherReview = review(1, "other", "COMMENTED");
    const otherComment = {
      ...remoteComment(1, 1),
      user: { login: "other" },
    };
    f.reviews.push(structuredClone(otherReview));
    f.comments.push(structuredClone(otherComment));
    if (hasPendingReview) f.reviews.push(review(2));

    assertEquals(await f.save(), {
      url: `${pull.url}/files`,
      state: "pending",
    });
    assertEquals(f.mutations, [
      hasPendingReview ? "AddPendingThread" : "CreatePendingReview",
    ]);
    assertEquals(f.reviews.length, 2);
    assertEquals(f.reviews[0], otherReview);
    assertEquals(f.comments.length, 2);
    assertEquals(f.comments[0], otherComment);
    assertEquals(f.comments[1].user.login, "viewer");
    assertEquals(f.comments[1].pull_request_review_id, 2);
    assertEquals(
      f.comments[1].body,
      `${input.body}\n\n<!-- sadoku-comment:key -->`,
    );
  });
}

Deno.test("finds the viewer's submitted comment after another account's comment with the same marker", async () => {
  const f = fixture();
  f.reviews.push(
    review(1, "other", "COMMENTED"),
    review(2, "viewer", "COMMENTED"),
  );
  f.comments.push(
    { ...remoteComment(1, 1), user: { login: "other" } },
    remoteComment(2, 2),
  );
  const originalComments = structuredClone(f.comments);

  assertEquals(await f.save(), {
    url: `${pull.url}#discussion_r2`,
    state: "submitted",
  });
  assertEquals(f.mutations, []);
  assertEquals(f.comments, originalComments);
});

Deno.test("paginates reviews and pending comments, excluding replies", async () => {
  const f = fixture();
  f.reviews.push(
    ...Array.from(
      { length: 100 },
      (_, i) => review(i + 1, "other", "COMMENTED"),
    ),
    review(101),
  );
  f.comments.push(
    ...Array.from(
      { length: 100 },
      (_, i) => ({ ...remoteComment(i + 1, 101), in_reply_to_id: 9 }),
    ),
    remoteComment(101, 101),
  );
  const found = await createGitHubCommentExporter(pull, f.run).inspect("key");
  assertEquals(found.pending?.id, "R101");
  assertEquals(found.comment?.id, "C101");
  assertEquals(
    f.calls.some((args) =>
      args.at(-1)!.includes("reviews?per_page=100&page=2")
    ),
    true,
  );
  assertEquals(
    f.calls.some((args) =>
      args.at(-1)!.includes("reviews/101/comments?per_page=100&page=2")
    ),
    true,
  );
});

for (const action of ["add", "update"] as const) {
  for (
    const change of ["submit", "discard", "head", "author", "edit"] as const
  ) {
    if (action === "add" && change === "edit") continue;
    Deno.test(`refuses ${action} when GitHub changes (${change}) before the mutation`, async () => {
      const f = fixture();
      f.reviews.push(review());
      if (action === "update") f.comments.push(remoteComment());
      f.beforeGuard(() => {
        if (change === "submit") f.reviews[0].state = "COMMENTED";
        if (change === "discard") f.reviews.length = 0;
        if (change === "head") f.reviews[0].commit_id = "old";
        if (change === "author") f.reviews[0].user.login = "other";
        if (change === "edit") f.comments[0].body = "Edited in browser";
      });
      let error: unknown;
      try {
        await f.save();
      } catch (caught) {
        error = caught;
      }
      assertEquals(error, { type: "export_review_out_of_sync" });
      assertEquals(f.mutations.length, 0);
    });
  }
}

Deno.test("GraphQL errors are failures even with data, and mutations are not retried", async () => {
  const f = fixture();
  f.fail("CreatePendingReview");
  await assertRejects(() => f.save(), Error, "GraphQL request failed");
  assertEquals(
    f.calls.filter((args) =>
      args.some((arg) => arg.startsWith("query=mutation CreatePendingReview"))
    ).length,
    1,
  );
  assertEquals(f.reviews.length, 0);
});

Deno.test("single-line pending comments omit range-start fields", async () => {
  const f = fixture();
  await createGitHubCommentExporter(pull, f.run).createPending("PR", {
    ...input,
    startLine: 4,
  }, "key");
  assertEquals(f.calls.flat().some((arg) => arg.includes("startLine")), false);
});

Deno.test("GitHub diff eligibility handles multiple hunks, removed files and absent patches", async () => {
  const exporter = createGitHubCommentExporter(pull, () =>
    response([
      {
        filename: "renamed.md",
        status: "renamed",
        patch:
          "@@ -1,3 +2,3 @@\n context\n+added\n context\n@@ -20 +21 @@\n context",
      },
      { filename: "removed.md", status: "removed", patch: "@@ -1 +1 @@" },
      { filename: "truncated.md", status: "modified" },
    ]));
  assertEquals(await exporter.supportsRange("renamed.md", 2, 4), true);
  assertEquals(await exporter.supportsRange("renamed.md", 4, 21), false);
  assertEquals(await exporter.supportsRange("renamed.md", 21, 21), true);
  assertEquals(await exporter.supportsRange("removed.md", 1, 1), false);
  assertEquals(await exporter.supportsRange("truncated.md", 1, 1), false);
});

Deno.test("GitHub failures and unsafe URLs fail closed", async () => {
  await assertRejects(
    () => createGitHubCommentExporter(pull, () => response({}, 1)).readPull(),
    Error,
    "GitHub request failed",
  );
  const f = fixture();
  f.reviews.push(review(1, "viewer", "COMMENTED"));
  f.comments.push({ ...remoteComment(), html_url: "javascript:alert(1)" });
  await assertRejects(
    () => createGitHubCommentExporter(pull, f.run).inspect("key"),
    Error,
    "invalid comment URL",
  );
});
