import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCommentableLines,
  useCommentableBlockLayout,
} from "../markdown/commentable/useCommentableBlockLayout";
import type { RangeHighlight } from "../markdown/commentable/commentRanges";
import { act, cleanup, render, screen, waitFor } from "./testUtils";

const mockRect = (top: number, bottom: number): DOMRect => ({
  bottom,
  height: bottom - top,
  left: 0,
  right: 800,
  top,
  width: 800,
  x: 0,
  y: top,
  toJSON: () => ({}),
});

const originalResizeObserver = globalThis.ResizeObserver;
const resizeObservers: RecordingResizeObserver[] = [];

class RecordingResizeObserver {
  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();

  constructor(readonly callback: ResizeObserverCallback) {
    resizeObservers.push(this);
  }
}

const LayoutHarness = ({ ranges }: { ranges: RangeHighlight[] }) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const { commentableLines, rangeHighlightLayouts } = useCommentableBlockLayout(
    previewRef,
    ranges,
  );

  return (
    <div
      data-layouts={JSON.stringify(rangeHighlightLayouts)}
      data-lines={commentableLines.join(",")}
      data-testid="preview"
      ref={previewRef}
    >
      <div
        className="commentable-block"
        data-source-end-line="2"
        data-source-line="1"
      >
        <div className="commentable-content" data-testid="first" />
      </div>
      <div className="commentable-block" data-source-line="4">
        <div className="commentable-content" data-testid="second" />
      </div>
    </div>
  );
};

beforeEach(() => {
  resizeObservers.length = 0;
  globalThis.ResizeObserver =
    RecordingResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  globalThis.ResizeObserver = originalResizeObserver;
});

describe("commentable block layout", () => {
  it("collects direct and list-nested commentable source lines", () => {
    const preview = document.createElement("div");
    preview.innerHTML = `
      <div class="commentable-block" data-source-line="7"></div>
      <ul class="comment-markdown-list">
        <li><div class="commentable-block" data-source-line="3"></div></li>
      </ul>
      <section><div class="commentable-block" data-source-line="1"></div></section>
    `;

    expect(getCommentableLines(preview)).toEqual([3, 7]);
  });

  it("measures range highlights again when the preview is resized", async () => {
    const ranges: RangeHighlight[] = [{
      startLine: 1,
      endLine: 4,
      kind: "selection",
    }];
    const { unmount } = render(<LayoutHarness ranges={ranges} />);
    const preview = screen.getByTestId("preview");
    const first = screen.getByTestId("first");
    const second = screen.getByTestId("second");
    expect(preview.dataset.lines).toBe("1,4");
    expect(resizeObservers).toHaveLength(1);
    expect(resizeObservers[0].observe).toHaveBeenCalledWith(preview);

    preview.getBoundingClientRect = () => mockRect(100, 400);
    first.getBoundingClientRect = () => mockRect(120, 150);
    second.getBoundingClientRect = () => mockRect(210, 250);
    act(() => {
      resizeObservers[0].callback(
        [],
        resizeObservers[0] as unknown as ResizeObserver,
      );
    });

    await waitFor(() =>
      expect(JSON.parse(preview.dataset.layouts ?? "[]")).toEqual([{
        startLine: 1,
        endLine: 4,
        kind: "selection",
        top: 20,
        bottom: 150,
      }])
    );

    unmount();
    expect(resizeObservers[0].disconnect).toHaveBeenCalledOnce();
  });
});
