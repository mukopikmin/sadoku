import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCommentableLines,
  measureRangeHighlightLayouts,
  useCommentableBlockLayout,
} from "../markdown/commentable/useCommentableBlockLayout";
import type { RangeHighlight } from "../markdown/commentable/commentRanges";
import { act, cleanup, render, screen, waitFor } from "./domTestUtils";

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
  it.each(["hover", "comment", "selection"] as const)(
    "uses the full padded content bounds for %s, including indented diff blocks",
    (kind) => {
      const preview = document.createElement("div");
      preview.setAttribute("data-document-diff", "");
      preview.innerHTML = `
        <div class="document-diff-addition">
          <div class="commentable-block" data-source-line="3" data-source-end-line="5">
            <div class="commentable-content" style="padding: 12px">Content</div>
          </div>
        </div>`;
      preview.getBoundingClientRect = () => new DOMRect(40, 100, 800, 400);
      preview.querySelector(".commentable-content")!.getBoundingClientRect =
        () => new DOMRect(55, 120, 785, 64);
      expect(
        measureRangeHighlightLayouts(preview, [
          { startLine: 3, endLine: 5, kind },
        ]),
      ).toEqual([{ startLine: 3, endLine: 5, kind, top: 20, bottom: 84 }]);
      const overlapping = ["hover", "comment", "selection"]
        .slice(0, ["hover", "comment", "selection"].indexOf(kind) + 1)
        .map((state) => ({
          startLine: 4,
          endLine: 4,
          kind: state as RangeHighlight["kind"],
        }));
      expect(measureRangeHighlightLayouts(preview, overlapping)).toEqual([
        { startLine: 4, endLine: 4, kind, top: 20, bottom: 84 },
      ]);
      if (kind === "comment") {
        expect(
          measureRangeHighlightLayouts(preview, [
            { startLine: 2, endLine: 2, kind },
          ]),
        ).toEqual([{ startLine: 2, endLine: 2, kind, top: 20, bottom: 84 }]);
      }
    },
  );

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

  it.each(["comment", "selection"] as const)(
    "joins adjacent %s blocks across diff boundaries",
    (kind) => {
      const preview = document.createElement("div");
      preview.setAttribute("data-document-diff", "");
      preview.innerHTML = `
      <div class="commentable-block" data-source-line="1"><div class="commentable-content"></div></div>
      <div class="document-diff-addition">
        <div class="commentable-block" data-source-line="3"><div class="commentable-content"></div></div>
      </div>
      <div class="document-diff-addition">
        <ul class="comment-markdown-list">
          <li><div class="commentable-block" data-source-line="5"><div class="commentable-content"></div></div></li>
        </ul>
      </div>
      <div class="commentable-block" data-source-line="7"><div class="commentable-content"></div></div>
    `;
      preview.getBoundingClientRect = () => mockRect(100, 400);
      const contents = preview.querySelectorAll<HTMLElement>(
        ".commentable-content",
      );
      contents.forEach((content, index) => {
        content.getBoundingClientRect = () =>
          mockRect(110 + index * 50, 140 + index * 50);
      });

      expect(
        measureRangeHighlightLayouts(preview, [
          { startLine: 1, endLine: 7, kind },
        ]),
      ).toEqual([{ startLine: 1, endLine: 7, kind, top: 10, bottom: 190 }]);
      expect(
        measureRangeHighlightLayouts(preview, [
          { startLine: 1, endLine: 3, kind },
          { startLine: 5, endLine: 7, kind },
        ]),
      ).toEqual([
        { startLine: 1, endLine: 3, kind, top: 10, bottom: 90 },
        { startLine: 5, endLine: 7, kind, top: 110, bottom: 190 },
      ]);
    },
  );

  it.each(["comment", "selection"] as const)(
    "splits %s outlines at removed content in diff mode",
    (kind) => {
      const preview = document.createElement("div");
      preview.setAttribute("data-document-diff", "");
      preview.innerHTML = `
      <div class="commentable-block" data-source-line="1"><div class="commentable-content"></div></div>
      <div class="document-diff-deletion">Removed content</div>
      <div class="document-diff-addition">
        <div class="commentable-block" data-source-line="3"><div class="commentable-content"></div></div>
      </div>
    `;
      preview.getBoundingClientRect = () => mockRect(100, 400);
      const contents = preview.querySelectorAll<HTMLElement>(
        ".commentable-content",
      );
      contents[0].getBoundingClientRect = () => mockRect(110, 140);
      contents[1].getBoundingClientRect = () => mockRect(300, 340);
      expect(getCommentableLines(preview)).toEqual([1, 3]);
      expect(
        measureRangeHighlightLayouts(preview, [
          { startLine: 1, endLine: 3, kind },
        ]),
      ).toEqual([
        { startLine: 1, endLine: 3, kind, top: 10, bottom: 40 },
        { startLine: 1, endLine: 3, kind, top: 200, bottom: 240 },
      ]);
    },
  );

  it("measures range highlights again when the preview is resized", async () => {
    const ranges: RangeHighlight[] = [
      {
        startLine: 1,
        endLine: 4,
        kind: "selection",
      },
    ];
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
      expect(JSON.parse(preview.dataset.layouts ?? "[]")).toEqual([
        {
          startLine: 1,
          endLine: 4,
          kind: "selection",
          top: 20,
          bottom: 150,
        },
      ]),
    );

    unmount();
    expect(resizeObservers[0].disconnect).toHaveBeenCalledOnce();
  });
});
