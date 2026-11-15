import { afterEach, expect, it, vi } from "vitest";
import { useTextEditor } from "../hooks/useTextEditor";
import { act, cleanup, renderHook } from "./domTestUtils";
import { deferred } from "./hookTestUtils";
afterEach(cleanup);

it("retains failed edits for correction and retry, then closes only on success", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("Conflict"))
    .mockResolvedValue(undefined);
  const saved = vi.fn();
  const { result } = renderHook(() =>
    useTextEditor({ initialValue: "Original", onSave: save, onSaved: saved }),
  );
  act(() => result.current.change("Draft"));
  await act(() => result.current.save());
  expect(result.current.state).toEqual({
    status: "error",
    draft: "Draft",
    message: "Conflict",
  });
  expect(saved).not.toHaveBeenCalled();
  act(() => result.current.change("Corrected"));
  expect(result.current.state.status).toBe("editing");
  await act(() => result.current.save());
  expect(save).toHaveBeenLastCalledWith("Corrected");
  expect(result.current.state.status).toBe("closed");
  expect(saved).toHaveBeenCalledOnce();
});

it("blocks same-tick duplicate submissions, edits and cancellation while saving", async () => {
  const request = deferred<void>();
  const save = vi.fn(() => request.promise);
  const { result } = renderHook(() =>
    useTextEditor({ initialValue: "Draft", onSave: save }),
  );
  let completion!: Promise<boolean>;
  act(() => {
    completion = result.current.save();
    void result.current.save();
    result.current.change("Overwrite");
    result.current.close();
  });
  expect(save).toHaveBeenCalledOnce();
  expect(result.current.state).toEqual({ status: "saving", draft: "Draft" });
  await act(async () => {
    request.resolve();
    await completion;
  });
  expect(result.current.state.status).toBe("closed");
});

it("ignores a late result after changing scope", async () => {
  const request = deferred<void>();
  const saved = vi.fn();
  const { result, rerender } = renderHook(
    ({ id }) =>
      useTextEditor({
        scope: id,
        initialValue: `Document ${id}`,
        onSave: () => request.promise,
        onSaved: saved,
      }),
    { initialProps: { id: 1 } },
  );
  let completion!: Promise<boolean>;
  act(() => {
    completion = result.current.save();
  });
  rerender({ id: 2 });
  await act(async () => {
    request.resolve();
    await completion;
  });
  expect(result.current.state).toEqual({
    status: "editing",
    draft: "Document 2",
  });
  expect(saved).not.toHaveBeenCalled();
});

it("validates empty drafts, allows explicit clearing, and resets on reopening", async () => {
  const save = vi.fn(async () => {});
  const { result, rerender } = renderHook(
    ({ allowEmpty }) =>
      useTextEditor({ allowEmpty, initiallyOpen: false, onSave: save }),
    { initialProps: { allowEmpty: false } },
  );
  await act(() => result.current.save());
  act(() => result.current.open("  "));
  await act(() => result.current.save());
  expect(save).not.toHaveBeenCalled();
  rerender({ allowEmpty: true });
  await act(() => result.current.save());
  expect(save).toHaveBeenCalledWith("  ");
  act(() => result.current.open("Fresh"));
  expect(result.current.state).toEqual({ status: "editing", draft: "Fresh" });
});

it("keeps the draft when a shared action reports failure", async () => {
  const { result } = renderHook(() =>
    useTextEditor({ initialValue: "Keep", onSave: async () => false }),
  );
  await act(() => result.current.save());
  expect(result.current.state).toEqual({ status: "editing", draft: "Keep" });
});
