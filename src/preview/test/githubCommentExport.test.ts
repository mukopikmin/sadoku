import { afterEach, expect, it, vi } from "vitest";
import { exportCommentToGitHub } from "../api/comments";
import { createComment } from "./testUtils";

afterEach(() => vi.unstubAllGlobals());

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
