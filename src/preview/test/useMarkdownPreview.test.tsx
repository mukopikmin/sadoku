import { afterEach, expect, it, vi } from "vitest";
import { useMarkdownPreview } from "../pages/markdown/useMarkdownPreview";
import { act, cleanup, renderHook } from "./domTestUtils";
import { createCommentActions } from "./commentFixtures";
vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));
afterEach(cleanup);
const props = {
  actions: createCommentActions(),
  comments: [],
  markdown: "# Title\nBody",
  showHtmlComments: true,
  theme: "default" as const,
};

it("coordinates selection, composing and raw source without losing the document context", () => {
  const { result } = renderHook(() => useMarkdownPreview(props));
  const range = { startLine: 1, endLine: 2 };
  act(() =>
    result.current.commentRenderingContext.onSelectCommentRange(range, {
      extend: false,
    }),
  );
  expect(result.current.commentRenderingContext.selectedRange).toEqual(range);
  act(() => result.current.commentRenderingContext.onOpenCommentForm());
  expect(result.current.commentRenderingContext.activeRange).toEqual(range);
  expect(result.current.commentRenderingContext.activeCommentLine).toBe(2);
  act(() => result.current.commentRenderingContext.onOpenRawMarkdown(range));
  expect(result.current.raw).toEqual({ status: "open", range });
  act(() => result.current.closeRaw());
  expect(result.current.raw.status).toBe("closed");
  act(() => result.current.commentRenderingContext.onCloseCommentForm());
  expect(result.current.commentRenderingContext.selectedRange).toBeUndefined();
  expect(result.current.commentRenderingContext.markdown).toBe(props.markdown);
});

it("keeps drafts across Markdown and diff updates", () => {
  const { result, rerender } = renderHook(
    ({ previousMarkdown }) =>
      useMarkdownPreview({ ...props, previousMarkdown }),
    { initialProps: { previousMarkdown: undefined as string | undefined } },
  );
  const drafts = result.current.commentRenderingContext.drafts!;
  drafts.set(2, "Keep this unfinished comment");
  rerender({ previousMarkdown: "Old text" });
  expect(result.current.commentRenderingContext.drafts).toBe(drafts);
  expect(result.current.commentRenderingContext.drafts?.get(2)).toBe(
    "Keep this unfinished comment",
  );
});
