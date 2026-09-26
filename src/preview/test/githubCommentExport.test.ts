import { afterEach, expect, it, vi } from "vitest";
import { exportCommentToGitHub } from "../api/comments";
import { createComment } from "./testUtils";

afterEach(() => vi.unstubAllGlobals());

it.each([
  ["export_review_out_of_sync", "pending review or comment changed"],
  ["export_markdown_changed", "displayed Markdown differs"],
  ["export_unavailable", "Only an open GitHub PR"],
  ["export_out_of_sync", "preview or comment is out of sync"],
  ["export_comment_not_found", "Comment not found"],
  ["export_comment_ineligible", "Only active human parent comments"],
  ["export_outside_diff", "outside a single available PR diff hunk"],
  ["export_busy", "already being saved"],
  ["export_json_required", "request could not be read"],
  ["export_invalid_request", "request is invalid"],
  ["export_document_not_found", "Document not found"],
  ["export_failed", "Check your connection"],
])("renders a frontend message for %s", async (code, message) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ error: { code, message: "Untrusted server text" } }, {
        status: 409,
      })
    ),
  );
  await expect(
    exportCommentToGitHub(1, "a".repeat(40), createComment(), "markdown"),
  ).rejects.toThrow(message);
});

it.each([
  { error: { code: "new_server_code", message: "Untrusted server text" } },
  { error: { code: "__proto__" } },
  { error: { code: 123 } },
  null,
  "Untrusted server text",
])("uses a frontend fallback for an unknown error %j", async (error) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      typeof error === "string"
        ? new Response(error, { status: 502 })
        : Response.json(error, { status: 502 })
    ),
  );
  await expect(
    exportCommentToGitHub(1, "a".repeat(40), createComment(), "markdown"),
  ).rejects.toThrow(
    "Could not save to the GitHub review. Check your connection",
  );
});

it("uses a frontend message when the request fails before a response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("Internal network details");
    }),
  );
  await expect(
    exportCommentToGitHub(1, "a".repeat(40), createComment(), "markdown"),
  ).rejects.toThrow(
    "Could not save to the GitHub review. Check your connection",
  );
});

it.each([
  { state: "pending", url: "https://github.com/o/r/pull/1/files" },
  { state: "submitted", url: "https://github.com/o/r/pull/1#discussion_r1" },
])("converts GitHub export result $state", async (result) => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(result)));
  expect(
    await exportCommentToGitHub(1, "a".repeat(40), createComment(), "markdown"),
  ).toEqual(result);
});

it.each([
  { state: "pending", url: "javascript:alert(1)" },
  { state: "pending", url: "https://github.com.evil.example/o/r/pull/1/files" },
  { state: "unknown", url: "https://github.com/o/r/pull/1/files" },
  { url: "https://github.com/o/r/pull/1/files" },
])("rejects invalid GitHub export result %j", async (result) => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(result)));
  await expect(
    exportCommentToGitHub(1, "a".repeat(40), createComment(), "markdown"),
  ).rejects.toThrow("Invalid GitHub review response");
});
