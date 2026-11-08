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

it("clears selection on category/filter changes and keeps tab counts independent of the active filter", () => {
  const actions = createCommentActions({
    onDeleteComment: vi.fn(async () => {}),
  });
  const { result } = renderHook(() => useCommentList(comments, actions));
  expect(result.current.sections.unresolved.count).toBe(2);
  act(() => result.current.bulk.toggle(1));
  act(() => result.current.selectFilter("stale"));
  expect(result.current.bulk.selectedIds).toEqual([]);
  expect(result.current.selectedSection.comments.map(({ id }) => id)).toEqual([
    2,
  ]);
  expect(result.current.sections.unresolved.count).toBe(2);
  act(() => result.current.selectCategory("resolved"));
  expect(result.current.selectedSection.comments.map(({ id }) => id)).toEqual([
    3,
  ]);
});

it("locks category and filter changes during confirmation/deletion, and continues after partial failure", async () => {
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
    result.current.selectCategory("resolved");
    result.current.selectFilter("stale");
  });
  expect(result.current.selectedCategory).toBe("unresolved");
  expect(result.current.commentFilter.filter).toBe("all");
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
