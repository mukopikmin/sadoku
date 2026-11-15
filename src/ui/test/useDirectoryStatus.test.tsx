import { afterEach, expect, it, vi } from "vitest";
import { loadDirectoryStatus } from "../api/directoryStatus";
import { useDirectoryStatusQuery } from "../hooks/useDocuments";
import { act, cleanup, renderHook } from "./domTestUtils";
import { queryHook } from "./hookTestUtils";

vi.mock("../api/directoryStatus", () => ({ loadDirectoryStatus: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

it.each(["ready", "error"] as const)(
  "polls while loading and stops after the directory becomes %s",
  async (state) => {
    vi.useFakeTimers();
    vi.mocked(loadDirectoryStatus)
      .mockResolvedValueOnce({ state: "loading", detected: 3, registered: 1 })
      .mockResolvedValueOnce({ state: "loading", detected: 3, registered: 2 })
      .mockResolvedValue({
        state,
        detected: 3,
        registered: 3,
        ...(state === "error"
          ? { error: { name: "Error", message: "Scan failed" } }
          : {}),
      });
    const { result } = renderHook(useDirectoryStatusQuery, queryHook());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.data?.state).toBe("loading");
    expect(loadDirectoryStatus).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current.data?.registered).toBe(2);
    expect(loadDirectoryStatus).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current.data?.state).toBe(state);
    expect(loadDirectoryStatus).toHaveBeenCalledTimes(3);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(loadDirectoryStatus).toHaveBeenCalledTimes(3);
  },
);

it("stops polling when unmounted during discovery", async () => {
  vi.useFakeTimers();
  vi.mocked(loadDirectoryStatus).mockResolvedValue({
    state: "loading",
    detected: 3,
    registered: 1,
  });
  const { unmount } = renderHook(useDirectoryStatusQuery, queryHook());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(loadDirectoryStatus).toHaveBeenCalledOnce();
  unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(loadDirectoryStatus).toHaveBeenCalledOnce();
});
