import { afterEach, expect, it, vi } from "vitest";
import {
  loadGitHubAccount,
  type GitHubAccountResult,
} from "../api/githubAccount";
import { useGitHubAccount } from "../hooks/useGitHubAccount";
import { cleanup, renderHook, waitFor } from "./domTestUtils";
import { queryHook } from "./hookTestUtils";
vi.mock("../api/githubAccount", () => ({ loadGitHubAccount: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it.each([
  [{ ok: true, account: { login: "maintainer" } }, "authenticated"],
  [{ ok: false, message: "Not signed in" }, "unauthenticated"],
] as const)("exposes the account state for %j", async (response, status) => {
  vi.mocked(loadGitHubAccount).mockResolvedValue(
    response as GitHubAccountResult,
  );
  const { result, rerender } = renderHook(
    ({ enabled }) => useGitHubAccount(enabled),
    { ...queryHook(), initialProps: { enabled: false } },
  );
  expect(loadGitHubAccount).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.status).toBe(status));
  if (result.current.status === "authenticated")
    expect(result.current.account.login).toBe("maintainer");
});
it("exposes a request failure separately from unauthenticated", async () => {
  vi.mocked(loadGitHubAccount).mockRejectedValue(new Error("Offline"));
  const { result } = renderHook(() => useGitHubAccount(true), queryHook());
  await waitFor(() =>
    expect(result.current).toEqual({ status: "error", message: "Offline" }),
  );
});
