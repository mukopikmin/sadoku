import { afterEach, expect, it, vi } from "vitest";
import { loadGitHubAccount } from "../api/githubAccount";

afterEach(() => vi.unstubAllGlobals());

it("converts an authenticated GitHub account response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          account: { login: "octocat", name: "The Octocat", ignored: true },
          ok: true,
        }),
      ok: true,
    }),
  );

  await expect(loadGitHubAccount()).resolves.toEqual({
    account: { login: "octocat", name: "The Octocat" },
    ok: true,
  });
});

it("rejects an invalid GitHub account response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ account: {}, ok: true }),
      ok: true,
    }),
  );

  await expect(loadGitHubAccount()).rejects.toThrow(
    "GitHub account response is invalid.",
  );
});
