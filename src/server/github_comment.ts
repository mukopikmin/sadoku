import type { RunGitHubCommand } from "./github_pull.ts";
import type { GitHubPullSource } from "./source.ts";
import type {
  CommentExporter,
  CommentExportInput,
  ExportedComment,
  ReviewState,
} from "./usecase/comment/export_comment.ts";

const marker = (key: string) => `<!-- sadoku-comment:${key} -->`;
const markedBody = (input: CommentExportInput, key: string) =>
  `${input.body}\n\n${marker(key)}`;
const changedReview = (): never => {
  throw { type: "export_review_out_of_sync" } as const;
};

type ReviewResponse = {
  id: number;
  node_id: string;
  state: string;
  commit_id: string;
  user: { login: string };
};

type CommentResponse = {
  node_id: string;
  body: string;
  html_url: string;
  user: { login: string };
  in_reply_to_id?: number;
  pull_request_review_id: number;
  commit_id: string;
  path: string;
  line: number | null;
  start_line?: number | null;
  side: string;
};

export const createGitHubCommentExporter = (
  pull: GitHubPullSource,
  run: RunGitHubCommand,
): CommentExporter => {
  const endpoint = `repos/${encodeURIComponent(pull.owner)}/${
    encodeURIComponent(pull.repo)
  }/pulls/${pull.pullNumber}`;
  const pendingResult = { url: `${pull.url}/files`, state: "pending" as const };
  const api = async <T>(path: string, args: string[] = []): Promise<T> => {
    const result = await run([
      "api",
      "--hostname",
      "github.com",
      ...args,
      path,
    ]);
    if (result.code !== 0) {
      throw new Error(
        "GitHub request failed. Check authentication, permissions and the pending review on GitHub before retrying. Nothing is submitted automatically.",
      );
    }
    return JSON.parse(new TextDecoder().decode(result.stdout));
  };
  const graphql = async <T>(
    query: string,
    variables: Record<string, string | number>,
  ): Promise<T> => {
    const args = ["--raw-field", `query=${query}`];
    for (const [name, value] of Object.entries(variables)) {
      args.push(
        typeof value === "number" ? "--field" : "--raw-field",
        `${name}=${value}`,
      );
    }
    const result = await api<{ data?: T; errors?: unknown[] }>("graphql", args);
    if (result.errors?.length || !result.data) {
      throw new Error(
        "GitHub could not save the pending review. Check the review on GitHub before retrying.",
      );
    }
    return result.data;
  };
  const pages = async <T>(path: string): Promise<T[]> => {
    const all: T[] = [];
    for (let page = 1;; page++) {
      const values = await api<T[]>(`${path}?per_page=100&page=${page}`);
      if (!Array.isArray(values)) {
        throw new Error("GitHub returned an invalid list.");
      }
      all.push(...values);
      if (values.length < 100) return all;
    }
  };
  // This cache lasts for one export request, not for the Sadoku session.
  let login: string | undefined;
  const viewer = async () => {
    if (!login) {
      const user = await api<{ login?: unknown }>("user");
      if (typeof user.login !== "string" || !user.login) {
        throw new Error("GitHub returned an invalid user.");
      }
      login = user.login;
    }
    return login;
  };
  const validUrl = (value: string): string => {
    const prefix = `${pull.url}#discussion_r`;
    if (
      typeof value !== "string" || !value.startsWith(prefix) ||
      !/^\d+$/.test(value.slice(prefix.length))
    ) {
      throw new Error("GitHub returned an invalid comment URL.");
    }
    return value;
  };
  const toExport = (
    comment: CommentResponse,
    key: string,
    review?: ReviewResponse,
  ): ExportedComment => {
    if (typeof comment.node_id !== "string" || !comment.node_id) {
      throw new Error("GitHub returned an invalid comment ID.");
    }
    return {
      id: comment.node_id,
      reviewId: review?.node_id ?? "",
      state: review ? "pending" : "submitted",
      url: review ? pendingResult.url : validUrl(comment.html_url),
      body: comment.body.slice(0, -marker(key).length).replace(/\n\n$/, ""),
      headSha: comment.commit_id,
      path: comment.path,
      startLine: comment.side === "RIGHT"
        ? comment.start_line ?? comment.line
        : null,
      endLine: comment.side === "RIGHT" ? comment.line : null,
    };
  };
  const assertPendingReview = async (
    reviewId: string,
    input: CommentExportInput,
  ) => {
    const data = await graphql<
      {
        node: {
          state: string;
          commit: { oid: string };
          author: { login: string };
        } | null;
      }
    >(
      `query PendingReview($id: ID!) { node(id: $id) { ... on PullRequestReview { state commit { oid } author { login } } } }`,
      { id: reviewId },
    );
    if (
      !data.node || data.node.state !== "PENDING" ||
      data.node.commit?.oid !== input.headSha ||
      data.node.author?.login !== await viewer()
    ) changedReview();
  };
  const threadArguments = (input: CommentExportInput, key: string) => ({
    body: markedBody(input, key),
    path: input.path,
    line: input.endLine,
    ...(input.startLine !== input.endLine
      ? { startLine: input.startLine }
      : {}),
  });
  const threadFields = (input: CommentExportInput) =>
    `body: $body, path: $path, line: $line, side: RIGHT${
      input.startLine !== input.endLine
        ? ", startLine: $startLine, startSide: RIGHT"
        : ""
    }`;
  const threadVariables = (input: CommentExportInput) =>
    `$body: String!, $path: String!, $line: Int!${
      input.startLine !== input.endLine ? ", $startLine: Int!" : ""
    }`;

  return {
    readPull: async () => {
      const value = await api<
        { node_id?: unknown; head?: { sha?: unknown }; state?: unknown }
      >(endpoint);
      if (
        typeof value.node_id !== "string" ||
        typeof value.head?.sha !== "string" || typeof value.state !== "string"
      ) throw new Error("GitHub returned invalid pull request data.");
      return {
        id: value.node_id,
        headSha: value.head.sha,
        open: value.state === "open",
      };
    },
    inspect: async (key): Promise<ReviewState> => {
      const author = await viewer();
      const reviews = await pages<ReviewResponse>(`${endpoint}/reviews`);
      const pending = reviews.filter((review) =>
        review.user?.login === author && review.state === "PENDING"
      );
      if (pending.length > 1) changedReview();
      const review = pending[0];
      if (
        review &&
        (typeof review.node_id !== "string" || !review.node_id ||
          typeof review.commit_id !== "string" ||
          !Number.isSafeInteger(review.id) || review.id < 1)
      ) {
        throw new Error("GitHub returned an invalid pending review.");
      }
      const state: ReviewState = review
        ? { pending: { id: review.node_id, headSha: review.commit_id } }
        : {};
      const matches = (comment: CommentResponse) =>
        comment.user?.login === author && !comment.in_reply_to_id &&
        typeof comment.body === "string" && comment.body.endsWith(marker(key));
      if (review) {
        const comments = await pages<CommentResponse>(
          `${endpoint}/reviews/${review.id}/comments`,
        );
        const existing = comments.find((comment) =>
          comment.pull_request_review_id === review.id && matches(comment)
        );
        if (existing) {
          return { ...state, comment: toExport(existing, key, review) };
        }
      }
      const comments = await pages<CommentResponse>(`${endpoint}/comments`);
      const existing = comments.find((comment) =>
        comment.pull_request_review_id !== review?.id && matches(comment)
      );
      return existing ? { ...state, comment: toExport(existing, key) } : state;
    },
    supportsRange: async (path, start, end) => {
      for (let page = 1;; page++) {
        const files = await api(`${endpoint}/files?per_page=100&page=${page}`);
        if (!Array.isArray(files)) {
          throw new Error("GitHub returned invalid files.");
        }
        const file = files.find((file) => file.filename === path);
        if (file) {
          if (file.status === "removed" || typeof file.patch !== "string") {
            return false;
          }
          // Both endpoints must belong to the same RIGHT-side diff hunk.
          return file.patch.split("\n").some((line: string) => {
            const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
            if (!match) return false;
            const first = Number(match[1]);
            const count = Number(match[2] ?? 1);
            return start >= first && end < first + count;
          });
        }
        if (files.length < 100) return false;
      }
    },
    createPending: async (pullId, input, key) => {
      // Creating the review and its first comment in one mutation avoids empty
      // reviews after partial failures. Omit event so the review stays pending.
      const data = await graphql<
        {
          addPullRequestReview: {
            pullRequestReview: { id: string; state: string };
          };
        }
      >(
        `mutation CreatePendingReview($pullId: ID!, $sha: GitObjectID!, ${
          threadVariables(input)
        }) {
          addPullRequestReview(input: {pullRequestId: $pullId, commitOID: $sha, threads: [{${
          threadFields(input)
        }}]}) {
            pullRequestReview { id state }
          }
        }`,
        { pullId, sha: input.headSha, ...threadArguments(input, key) },
      );
      if (
        !data.addPullRequestReview?.pullRequestReview?.id ||
        data.addPullRequestReview.pullRequestReview.state !== "PENDING"
      ) changedReview();
      return pendingResult;
    },
    addPending: async (reviewId, input, key) => {
      await assertPendingReview(reviewId, input);
      const data = await graphql<
        { addPullRequestReviewThread: { thread: { id: string } } }
      >(
        `mutation AddPendingThread($reviewId: ID!, ${threadVariables(input)}) {
          addPullRequestReviewThread(input: {pullRequestReviewId: $reviewId, ${
          threadFields(input)
        }}) { thread { id } }
        }`,
        { reviewId, ...threadArguments(input, key) },
      );
      if (!data.addPullRequestReviewThread?.thread?.id) {
        throw new Error("GitHub returned an invalid pending thread.");
      }
      return pendingResult;
    },
    updatePending: async (comment, input, key) => {
      // Recheck the exact remote body and review immediately before updating.
      // A submitted or externally changed comment must not be silently edited.
      const data = await graphql<
        {
          node: {
            body: string;
            pullRequestReview: {
              id: string;
              state: string;
              author: { login: string };
              commit: { oid: string };
            };
          } | null;
        }
      >(
        `query PendingComment($id: ID!) { node(id: $id) { ... on PullRequestReviewComment { body pullRequestReview { id state author { login } commit { oid } } } } }`,
        { id: comment.id },
      );
      const review = data.node?.pullRequestReview;
      if (
        !review || review.id !== comment.reviewId ||
        review.state !== "PENDING" || review.author?.login !== await viewer() ||
        review.commit?.oid !== input.headSha ||
        data.node?.body !== `${comment.body}\n\n${marker(key)}`
      ) changedReview();
      const updated = await graphql<
        {
          updatePullRequestReviewComment: {
            pullRequestReviewComment: { id: string };
          };
        }
      >(
        `mutation UpdatePendingComment($id: ID!, $body: String!) { updatePullRequestReviewComment(input: {pullRequestReviewCommentId: $id, body: $body}) { pullRequestReviewComment { id } } }`,
        { id: comment.id, body: markedBody(input, key) },
      );
      if (
        updated.updatePullRequestReviewComment?.pullRequestReviewComment?.id !==
          comment.id
      ) throw new Error("GitHub returned an invalid updated comment.");
      return pendingResult;
    },
  };
};
