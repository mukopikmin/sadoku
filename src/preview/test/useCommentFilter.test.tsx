import { afterEach, expect, it } from "vitest";
import { useCommentFilter } from "../pages/comments/useCommentFilter";
import { createComment } from "./commentFixtures";
import { act, cleanup, renderHook } from "./domTestUtils";
afterEach(cleanup);
it("defaults to unresolved states and independently combines states with live counts", () => {
  const active = createComment();
  const stale = createComment({ id: 2, state: "stale" });
  const resolved = createComment({ id: 3, state: "resolved" });
  const { result, rerender } = renderHook(
    ({ comments }) => useCommentFilter(comments),
    { initialProps: { comments: [active, stale, resolved] } },
  );
  expect(result.current.selectedFilters).toEqual(["active", "stale"]);
  expect(result.current.visibleComments).toEqual([active, stale]);
  act(() => result.current.toggleFilter("resolved"));
  expect(result.current.visibleComments).toEqual([active, stale, resolved]);
  act(() => {
    result.current.toggleFilter("active");
    result.current.toggleFilter("stale");
  });
  expect(result.current.visibleComments).toEqual([resolved]);
  rerender({ comments: [active, { ...stale, state: "resolved" }, resolved] });
  expect(result.current.visibleComments).toHaveLength(2);
  expect(result.current.filters.resolved.comments).toHaveLength(2);
  act(() => result.current.toggleFilter("resolved"));
  expect(result.current.visibleComments).toEqual([]);
  expect(result.current.emptyText).toBe(
    "Select a comment state to show comments.",
  );
  expect(result.current.totalCount).toBe(3);
});
