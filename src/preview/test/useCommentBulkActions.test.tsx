import { createComment, createCommentActions } from "./commentFixtures";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCommentBulkActions } from "../pages/comments/useCommentBulkActions";
import { act, cleanup, renderHook } from "./domTestUtils";

afterEach(cleanup);

describe("useCommentBulkActions", () => {
  it("selects, deselects, and removes comments that leave the view", () => {
    const actions = createCommentActions();
    const comments = [createComment(), createComment({ id: 2 })];
    const { result, rerender } = renderHook(
      ({ comments }) => useCommentBulkActions(comments, actions),
      { initialProps: { comments } },
    );

    act(() => result.current.toggle(1));
    expect(result.current.selectedIds).toEqual([1]);
    act(() => result.current.toggle(1));
    expect(result.current.selectedIds).toEqual([]);
    act(() => result.current.toggleAll());
    expect(result.current.selectedIds).toEqual([1, 2]);
    act(() => result.current.toggleAll());
    expect(result.current.selectedIds).toEqual([]);

    act(() => result.current.toggleAll());
    rerender({ comments: [comments[1]] });
    expect(result.current.selectedIds).toEqual([2]);
    rerender({ comments });
    expect(result.current.selectedIds).toEqual([2]);
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds).toEqual([]);
  });

  it("runs sequentially and blocks duplicate actions and selection changes", async () => {
    let release!: () => void;
    const ready = new Promise<void>((resolve) => release = resolve);
    const onResolveComment = vi.fn(async () => await ready);
    const onDeleteComment = vi.fn();
    const { result } = renderHook(() =>
      useCommentBulkActions(
        [createComment(), createComment({ id: 2 })],
        createCommentActions({ onResolveComment, onDeleteComment }),
      )
    );
    act(() => result.current.toggleAll());
    let operation!: Promise<boolean>;
    act(() => {
      operation = result.current.run("resolve");
      void result.current.run("delete");
      result.current.toggle(1);
      result.current.toggleAll();
      result.current.clearSelection();
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.selectedIds).toEqual([1, 2]);
    expect(onResolveComment.mock.calls).toEqual([[1]]);
    expect(onDeleteComment).not.toHaveBeenCalled();

    release();
    await act(async () => expect(await operation).toBe(true));
    expect(onResolveComment.mock.calls).toEqual([[1], [2]]);
    expect(result.current.isPending).toBe(false);
    expect(result.current.selectedIds).toEqual([]);
  });

  it("continues after failures and retries only failed comments", async () => {
    const onDeleteComment = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Connection lost."))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useCommentBulkActions(
        [createComment(), createComment({ id: 2 }), createComment({ id: 3 })],
        createCommentActions({ onDeleteComment }),
      )
    );
    act(() => result.current.toggleAll());
    await act(async () =>
      expect(await result.current.run("delete")).toBe(false)
    );

    expect(onDeleteComment.mock.calls).toEqual([[1], [2], [3]]);
    expect(result.current.selectedIds).toEqual([2]);
    expect(result.current.state).toEqual({
      status: "error",
      message: "Could not delete 1 of 3 selected comments. Connection lost.",
    });

    await act(async () =>
      expect(await result.current.run("delete")).toBe(true)
    );
    expect(onDeleteComment.mock.calls).toEqual([[1], [2], [3], [2]]);
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("reopens only selected comments and ignores an empty selection", async () => {
    const onReopenComment = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useCommentBulkActions(
        [
          createComment({ state: "resolved" }),
          createComment({ id: 2, state: "resolved" }),
        ],
        createCommentActions({ onReopenComment }),
      )
    );
    await act(async () =>
      expect(await result.current.run("reopen")).toBe(false)
    );
    expect(onReopenComment).not.toHaveBeenCalled();
    act(() => result.current.toggle(2));
    await act(() => result.current.run("reopen"));
    expect(onReopenComment.mock.calls).toEqual([[2]]);
  });
});
