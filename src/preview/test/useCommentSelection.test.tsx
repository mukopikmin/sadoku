import { afterEach, expect, it } from "vitest";
import { useCommentSelection } from "../markdown/commentable/useCommentSelection";
import { act, cleanup, renderHook } from "./domTestUtils";
afterEach(cleanup);

it("models selection, range extension and composing as exclusive states", () => {
  const { result } = renderHook(useCommentSelection);
  act(() => result.current.openCommentForm());
  expect(result.current.state.status).toBe("none");
  act(() =>
    result.current.selectCommentRange(
      { startLine: 4, endLine: 5 },
      { extend: false },
    ),
  );
  expect(result.current.state).toEqual({
    status: "selected",
    range: { startLine: 4, endLine: 5 },
    anchorLine: 4,
  });
  act(() =>
    result.current.selectCommentRange(
      { startLine: 1, endLine: 2 },
      { extend: true },
    ),
  );
  act(() => result.current.openCommentForm());
  expect(result.current.state).toEqual({
    status: "composing",
    range: { startLine: 1, endLine: 4 },
    anchorLine: 4,
  });
  act(() => result.current.closeCommentForm());
  expect(result.current.state.status).toBe("none");
});

it("deselects an identical range and exits the composer when selecting another line", () => {
  const { result } = renderHook(useCommentSelection);
  const range = { startLine: 3, endLine: 3 };
  act(() => result.current.selectCommentRange(range, { extend: false }));
  act(() => result.current.openCommentForm());
  act(() => result.current.selectCommentRange(range, { extend: false }));
  expect(result.current.state.status).toBe("none");
  act(() => result.current.selectCommentRange(range, { extend: false }));
  act(() => result.current.openCommentForm());
  act(() =>
    result.current.selectCommentRange(
      { startLine: 8, endLine: 8 },
      { extend: false },
    ),
  );
  expect(result.current.state).toEqual({
    status: "selected",
    range: { startLine: 8, endLine: 8 },
    anchorLine: 8,
  });
});
