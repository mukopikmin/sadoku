import { afterEach, expect, it, vi } from "vitest";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { act, cleanup, renderHook } from "./domTestUtils";
import { deferred } from "./hookTestUtils";
afterEach(cleanup);

it("rejects duplicate calls before a render and returns to idle after success", async () => {
  const request = deferred<void>();
  const run = vi.fn(() => request.promise);
  const { result } = renderHook(useAsyncAction);
  let completion!: Promise<boolean>;
  act(() => {
    completion = result.current.run(run);
    void result.current.run(run);
    result.current.reset();
  });
  expect(run).toHaveBeenCalledOnce();
  expect(result.current.state.status).toBe("pending");
  await act(async () => {
    request.resolve();
    expect(await completion).toBe(true);
  });
  expect(result.current.state.status).toBe("idle");
});

it("exposes an error, calls the reporter, and supports retry and reset", async () => {
  const report = vi.fn();
  const { result } = renderHook(useAsyncAction);
  await act(async () => {
    expect(
      await result.current.run(async () => {
        throw "Failed";
      }, report),
    ).toBe(false);
  });
  expect(result.current.state).toEqual({ status: "error", message: "Failed" });
  expect(report).toHaveBeenCalledWith("Failed");
  await act(() => result.current.run(async () => {}));
  expect(result.current.state.status).toBe("idle");
  act(() => {
    result.current.reportError(new Error("Clipboard"));
  });
  expect(result.current.state).toEqual({
    status: "error",
    message: "Clipboard",
  });
  act(() => result.current.reset());
  expect(result.current.state.status).toBe("idle");
});
