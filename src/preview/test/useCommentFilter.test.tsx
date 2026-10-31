import { afterEach, describe, expect, it } from "vitest";
import { useCommentFilter } from "../pages/comments/useCommentFilter";
import { createComment } from "./commentFixtures";
import { act, cleanup, renderHook } from "./domTestUtils";

afterEach(cleanup);

describe("useCommentFilter", () => {
  it("filters unresolved comments and derives counts from updated data", () => {
    const active = createComment();
    const stale = createComment({ id: 2, state: "stale" });
    const resolved = createComment({ id: 3, state: "resolved" });
    const { result, rerender } = renderHook(
      ({ comments }) => useCommentFilter(comments),
      { initialProps: { comments: [active, stale, resolved] } },
    );

    expect(result.current.filter).toBe("all");
    expect(result.current.visibleComments).toEqual([active, stale]);
    expect(result.current.resolvedComments).toEqual([resolved]);
    act(() => result.current.setFilter("active"));
    expect(result.current.visibleComments).toEqual([active]);
    act(() => result.current.setFilter("stale"));
    expect(result.current.visibleComments).toEqual([stale]);

    rerender({ comments: [active, { ...stale, state: "resolved" }, resolved] });
    expect(result.current.filter).toBe("stale");
    expect(result.current.visibleComments).toEqual([]);
    expect(result.current.emptyText).toBe("No stale unresolved comments.");
    expect(result.current.unresolvedCount).toBe(1);
    expect(result.current.filters.all.comments).toHaveLength(1);
    expect(result.current.filters.active.comments).toHaveLength(1);
    expect(result.current.filters.stale.comments).toHaveLength(0);
    expect(result.current.resolvedComments).toHaveLength(2);

    rerender({ comments: [createComment({ state: "stale" })] });
    expect(result.current.visibleComments).toHaveLength(1);
    act(() => result.current.setFilter("active"));
    expect(result.current.visibleComments).toEqual([]);
    expect(result.current.emptyText).toBe("No active unresolved comments.");
    rerender({ comments: [] });
    act(() => result.current.setFilter("all"));
    expect(result.current.emptyText).toBe("No unresolved comments.");
    expect(result.current.unresolvedCount).toBe(0);
  });
});
