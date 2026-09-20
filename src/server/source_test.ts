import { assertEquals } from "@std/assert";
import { createPreviewSource, parseGitHubPullUrl } from "./source.ts";

Deno.test("parseGitHubPullUrl recognizes and canonicalizes GitHub pull request URLs", () => {
  assertEquals(
    parseGitHubPullUrl(
      "https://github.com/octo/repo/pull/42?token=secret#files",
    ),
    {
      owner: "octo",
      repo: "repo",
      pullNumber: 42,
      url: "https://github.com/octo/repo/pull/42",
    },
  );
  assertEquals(
    parseGitHubPullUrl("https://example.com/octo/repo/pull/42"),
    undefined,
  );
  assertEquals(
    parseGitHubPullUrl("https://github.com/octo/repo/blob/main/readme.md"),
    undefined,
  );
});

Deno.test("createPreviewSource distinguishes pull requests from Markdown URLs", () => {
  const pull = createPreviewSource(
    "https://github.com/octo/repo/pull/42?token=secret#files",
  );
  assertEquals(pull.commentSource, "https://github.com/octo/repo/pull/42");
  assertEquals(pull.documentSource, "https://github.com/octo/repo/pull/42");
  assertEquals(pull.githubPull?.pullNumber, 42);

  const markdown = createPreviewSource(
    "https://github.com/octo/repo/raw/main/readme.md?token=secret#top",
  );
  assertEquals(
    markdown.commentSource,
    "https://github.com/octo/repo/raw/main/readme.md",
  );
  assertEquals(markdown.githubPull, undefined);
});
