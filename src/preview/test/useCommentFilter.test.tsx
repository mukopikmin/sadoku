import { afterEach, expect, it } from "vitest";
import { useCommentFilter } from "../pages/comments/useCommentFilter";
import type { CommentFilter } from "../pages/comments/useCommentFilter";
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

const states: CommentFilter[] = ["active", "stale", "resolved"];
const comments = states.map((state, index) =>
  createComment({ id: index + 1, state }),
);

it.each(
  Array.from(
    { length: 8 },
    (_, mask) =>
      [mask, states.filter((_, index) => mask & (1 << index))] as const,
  ),
)(
  "derives the visible comments for state combination %i",
  (_mask, selected) => {
    const { result } = renderHook(() => useCommentFilter(comments));
    act(() => {
      for (const state of states) {
        if (selected.includes(state) !== (state !== "resolved"))
          result.current.toggleFilter(state);
      }
    });
    expect([...result.current.selectedFilters].sort()).toEqual(
      [...selected].sort(),
    );
    expect(result.current.visibleComments).toEqual(
      comments.filter((comment) => selected.includes(comment.state)),
    );
    expect(result.current.totalCount).toBe(3);
    for (const state of states)
      expect(result.current.filters[state].comments).toEqual(
        comments.filter((comment) => comment.state === state),
      );
  },
);

it.each([
  ["active", "No active unresolved comments."],
  ["stale", "No stale unresolved comments."],
  ["resolved", "No resolved comments."],
] as const)(
  "keeps %s selected when it has no matches and includes new matches",
  (state, message) => {
    const { result, rerender } = renderHook(
      ({ comments }) => useCommentFilter(comments),
      { initialProps: { comments } },
    );
    act(() => {
      for (const candidate of states) {
        if ((candidate === state) !== (candidate !== "resolved"))
          result.current.toggleFilter(candidate);
      }
    });
    rerender({
      comments: comments.filter((comment) => comment.state !== state),
    });
    expect(result.current.selectedFilters).toEqual([state]);
    expect(result.current.visibleComments).toEqual([]);
    expect(result.current.emptyText).toBe(message);
    expect(result.current.filters[state].comments).toEqual([]);
    rerender({ comments });
    expect(result.current.visibleComments).toEqual(
      comments.filter((comment) => comment.state === state),
    );
  },
);

it("restores default states on remount", () => {
  const { result, unmount } = renderHook(() => useCommentFilter(comments));
  act(() => result.current.toggleFilter("resolved"));
  unmount();
  const next = renderHook(() => useCommentFilter(comments));
  expect(next.result.current.selectedFilters).toEqual(["active", "stale"]);
});
