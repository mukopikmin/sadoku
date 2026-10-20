import { equal } from "node:assert/strict";
import { parsePublicBasePath } from "./base_path.ts";

Deno.test("accepts an empty or canonical public base path", () => {
  for (
    const value of [null, "", "/revisions/v1", "/revisions/pr-42", "/preview"]
  ) {
    equal(parsePublicBasePath(value), value ?? "");
  }
});

Deno.test("rejects URL injection, traversal and ambiguous public base paths", () => {
  for (
    const value of [
      "/",
      "relative",
      "//evil.test",
      "https://evil.test",
      "/a/",
      "/a//b",
      "/a/../b",
      "/a/./b",
      "/a%2Fb",
      "/a%252Fb",
      "/a?b=1",
      "/a#b",
      "/a\\b",
      "/a,b",
      '/a" onclick="evil',
      "/a\nb",
      "/日本語",
      `/${"a".repeat(2048)}`,
    ]
  ) equal(parsePublicBasePath(value), undefined);
});
