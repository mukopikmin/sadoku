import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useCommentComposer } from "../markdown/commentable/useCommentComposer";
import { CommentRenderingContext } from "../markdown/commentable/commentRendering";
import { createCommentActions } from "./commentFixtures";
import { act, cleanup, renderHook } from "./domTestUtils";
import { deferred } from "./hookTestUtils";
afterEach(cleanup);
const setup = () => {
  const drafts = new Map<number, string>();
  const actions = createCommentActions({
    onCreateComment: vi.fn(async () => {}),
  });
  const close = vi.fn();
  const options = {
    actions,
    sourceRange: { startLine: 2, endLine: 2 },
    activeRange: { startLine: 1, endLine: 3 },
    onCloseCommentForm: close,
    onSelectCommentRange: vi.fn(),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CommentRenderingContext.Provider
      value={{
        actions,
        markdown: "First\n```typescript\nLast",
        drafts,
        commentsByLine: new Map(),
        commentHighlightsByLine: new Set(),
        rangeHighlights: [],
        onCloseCommentForm: close,
        onOpenCommentForm: vi.fn(),
        onOpenRawMarkdown: vi.fn(),
        onSelectCommentRange: vi.fn(),
      }}
    >
      {children}
    </CommentRenderingContext.Provider>
  );
  return { drafts, actions, close, options, wrapper };
};

it("keeps drafts across remounts and builds suggestions with a safe fence for the active range", () => {
  const { drafts, options, wrapper } = setup();
  const first = renderHook(() => useCommentComposer(options), { wrapper });
  act(() => first.result.current.change("Keep"));
  first.unmount();
  const second = renderHook(() => useCommentComposer(options), { wrapper });
  expect(second.result.current.state.draft).toBe("Keep");
  act(() => second.result.current.insertSuggestion());
  expect(second.result.current.state.draft).toBe(
    "Keep\n\n````suggest\nFirst\n```typescript\nLast\n````",
  );
  expect(drafts.get(2)).toBe(second.result.current.state.draft);
});

it("preserves a failed draft and range, prevents duplicate saves, and clears only on success", async () => {
  const { drafts, actions, options, wrapper, close } = setup();
  const request = deferred<void>();
  const create = vi
    .mocked(actions.onCreateComment)
    .mockReturnValueOnce(request.promise);
  const { result } = renderHook(() => useCommentComposer(options), { wrapper });
  await act(() => result.current.create());
  expect(create).not.toHaveBeenCalled();
  act(() => result.current.change(" Draft "));
  let completion!: Promise<void>;
  act(() => {
    completion = result.current.create();
    void result.current.create();
    result.current.change("Overwrite");
  });
  expect(result.current.state).toEqual({ status: "saving", draft: " Draft " });
  expect(create).toHaveBeenCalledOnce();
  expect(create).toHaveBeenCalledWith(1, "Draft", 3);
  await act(async () => {
    request.reject(new Error("Offline"));
    await completion;
  });
  expect(result.current.state).toEqual({
    status: "error",
    draft: " Draft ",
    message: "Offline",
  });
  expect(drafts.get(2)).toBe(" Draft ");
  expect(close).not.toHaveBeenCalled();
  await act(() => result.current.create());
  expect(drafts.has(2)).toBe(false);
  expect(close).toHaveBeenCalledOnce();
});
