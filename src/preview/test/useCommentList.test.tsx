import { afterEach, expect, it, vi } from "vitest";
import { useCommentList } from "../pages/comments/useCommentList";
import { createComment, createCommentActions } from "./commentFixtures";
import { act, cleanup, renderHook, waitFor } from "./domTestUtils";
import { deferred } from "./hookTestUtils";
afterEach(cleanup);
const comments = [
  createComment(),
  createComment({ id: 2, state: "stale" }),
  createComment({ id: 3, state: "resolved" }),
];

it.each(["active", "stale", "resolved"] as const)(
  "clears bulk selection when %s changes",
  (filter) => {
    const { result } = renderHook(() =>
      useCommentList(comments, createCommentActions()),
    );
    act(() => result.current.bulk.toggleAll());
    expect(result.current.bulk.selectedIds).toEqual([1, 2]);
    act(() => result.current.selectFilter(filter));
    expect(result.current.bulk.selectedIds).toEqual([]);
  },
);

it("blocks filter changes during resolve and unlocks them after completion", async () => {
  const request = deferred<void>();
  const actions = createCommentActions({
    onResolveComment: vi.fn(() => request.promise),
  });
  const { result } = renderHook(() => useCommentList(comments, actions));
  act(() => result.current.bulk.toggle(1));
  let completion!: Promise<boolean>;
  act(() => {
    completion = result.current.bulk.run("resolve");
  });
  act(() => result.current.selectFilter("resolved"));
  expect(result.current.commentFilter.selectedFilters).toEqual([
    "active",
    "stale",
  ]);
  expect(result.current.bulk.selectedIds).toEqual([1]);
  await act(async () => {
    request.resolve();
    await completion;
  });
  act(() => result.current.selectFilter("resolved"));
  expect(result.current.commentFilter.selectedFilters).toEqual([
    "active",
    "stale",
    "resolved",
  ]);
});

it("only resolves or reopens eligible selected comments in the unfiltered list", async () => {
  const actions = createCommentActions({
    onResolveComment: vi.fn(async () => {}),
    onReopenComment: vi.fn(async () => {}),
  });
  const { result } = renderHook(() => useCommentList(comments, actions));
  act(() => result.current.selectFilter("resolved"));
  act(() => result.current.bulk.toggleAll());
  expect(result.current.canResolve).toBe(true);
  expect(result.current.canReopen).toBe(true);
  await act(async () => {
    await result.current.bulk.run("resolve");
  });
  expect(vi.mocked(actions.onResolveComment).mock.calls).toEqual([[1], [2]]);
  expect(result.current.bulk.selectedIds).toEqual([3]);
  await act(async () => {
    await result.current.bulk.run("reopen");
  });
  expect(vi.mocked(actions.onReopenComment).mock.calls).toEqual([[3]]);
  expect(result.current.bulk.selectedIds).toEqual([]);
});

it("locks filter changes during confirmation/deletion, and continues after partial failure", async () => {
  const actions = createCommentActions({
    onDeleteComment: vi.fn(async () => {}),
  });
  const request = deferred<void>();
  vi.mocked(actions.onDeleteComment)
    .mockReturnValueOnce(request.promise)
    .mockRejectedValueOnce(new Error("Failed"));
  const { result } = renderHook(() => useCommentList(comments, actions));
  act(() => result.current.bulk.toggleAll());
  act(() => result.current.setDeleteOpen(true));
  act(() => {
    result.current.selectFilter("resolved");
    result.current.selectFilter("stale");
  });
  expect(result.current.commentFilter.selectedFilters).toEqual([
    "active",
    "stale",
  ]);
  let completion!: Promise<void>;
  act(() => {
    completion = result.current.confirmDelete();
    result.current.setDeleteOpen(false);
  });
  expect(result.current.deletion.status).toBe("deleting");
  await act(async () => {
    request.resolve();
    await completion;
  });
  await waitFor(() => expect(result.current.deletion.status).toBe("closed"));
  expect(result.current.bulk.state.status).toBe("error");
  expect(result.current.bulk.selectedIds).toEqual([2]);
});
