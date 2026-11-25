import { afterEach, expect, it } from "vitest";
import { useCommentFilter } from "../pages/comments/useCommentFilter";
import type { CommentFilter } from "../pages/comments/useCommentFilter";
import { createComment } from "./commentFixtures";
import { act, cleanup, renderHook } from "./domTestUtils";
afterEach(cleanup);
it("defaults to unresolved states and combines selected states as comments change", () => {
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
  const newlyResolved = { ...stale, state: "resolved" as const };
  rerender({ comments: [active, newlyResolved, resolved] });
  expect(result.current.visibleComments).toEqual([newlyResolved, resolved]);
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

// The transition and single-state tests cover the other six combinations.
it.each([
  { excluded: "stale", selected: ["active", "resolved"], visibleIds: [1, 3] },
  { excluded: "active", selected: ["stale", "resolved"], visibleIds: [2, 3] },
] as const)(
  "combines unresolved and resolved comments without $excluded",
  ({ excluded, selected, visibleIds }) => {
    const { result } = renderHook(() => useCommentFilter(comments));
    act(() => {
      result.current.toggleFilter("resolved");
      result.current.toggleFilter(excluded);
    });
    expect([...result.current.selectedFilters].sort()).toEqual(
      [...selected].sort(),
    );
    expect(result.current.visibleComments.map(({ id }) => id)).toEqual(
      visibleIds,
    );
    expect(result.current.totalCount).toBe(3);
  },
);

it.each([
  ["active", "No active unresolved comments.", comments[0]],
  ["stale", "No stale unresolved comments.", comments[1]],
  ["resolved", "No resolved comments.", comments[2]],
] as const)(
  "keeps %s selected when it has no matches and includes new matches",
  (state, message, matchingComment) => {
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
    rerender({ comments });
    expect(result.current.visibleComments).toEqual([matchingComment]);
  },
);

it("restores default states on remount", () => {
  const { result, unmount } = renderHook(() => useCommentFilter(comments));
  act(() => result.current.toggleFilter("resolved"));
  unmount();
  const next = renderHook(() => useCommentFilter(comments));
  expect(next.result.current.selectedFilters).toEqual(["active", "stale"]);
});
