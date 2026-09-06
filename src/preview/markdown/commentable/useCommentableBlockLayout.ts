import { type RefObject, useCallback, useLayoutEffect, useState } from "react";
import type { RangeHighlight } from "./commentRanges";

export type RangeHighlightLayout = RangeHighlight & {
  bottom: number;
  top: number;
};

export const commentableBlockSelector =
  ":scope > .commentable-block, :scope > .comment-markdown-list .commentable-block";

export const getCommentableLines = (preview: Element): number[] =>
  [...preview.querySelectorAll<HTMLElement>(commentableBlockSelector)]
    .map((block) => Number(block.dataset.sourceLine))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

export const measureRangeHighlightLayouts = (
  preview: HTMLElement,
  rangeHighlights: readonly RangeHighlight[],
): RangeHighlightLayout[] => {
  const previewRect = preview.getBoundingClientRect();
  const blocks = [...preview.querySelectorAll<HTMLElement>(
    commentableBlockSelector,
  )];

  return rangeHighlights.flatMap((range) => {
    const contents = blocks.filter((block) => {
      const startLine = Number(block.dataset.sourceLine);
      const endLine = Number(block.dataset.sourceEndLine ?? startLine);
      return endLine >= range.startLine && startLine <= range.endLine;
    }).map((block) =>
      block.querySelector<HTMLElement>(":scope > .commentable-content")
    ).filter((content): content is HTMLElement => content !== null);
    if (contents.length === 0) return [];

    const rects = contents.map((content) => content.getBoundingClientRect());
    return [{
      ...range,
      top: Math.min(...rects.map((rect) => rect.top)) - previewRect.top,
      bottom: Math.max(...rects.map((rect) => rect.bottom)) - previewRect.top,
    }];
  });
};

const arraysEqual = <Value>(
  left: readonly Value[],
  right: readonly Value[],
  isEqual: (left: Value, right: Value) => boolean,
): boolean =>
  left.length === right.length &&
  left.every((value, index) => isEqual(value, right[index]));

const rangeHighlightLayoutsEqual = (
  left: readonly RangeHighlightLayout[],
  right: readonly RangeHighlightLayout[],
): boolean =>
  arraysEqual(
    left,
    right,
    (leftLayout, rightLayout) =>
      leftLayout.bottom === rightLayout.bottom &&
      leftLayout.endLine === rightLayout.endLine &&
      leftLayout.kind === rightLayout.kind &&
      leftLayout.startLine === rightLayout.startLine &&
      leftLayout.top === rightLayout.top,
  );

export const useCommentableBlockLayout = (
  previewRef: RefObject<HTMLElement | null>,
  rangeHighlights: readonly RangeHighlight[],
) => {
  const [commentableLines, setCommentableLines] = useState<number[]>([]);
  const [rangeHighlightLayouts, setRangeHighlightLayouts] = useState<
    RangeHighlightLayout[]
  >([]);

  const updateRangeHighlightLayouts = useCallback(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const layouts = measureRangeHighlightLayouts(preview, rangeHighlights);
    setRangeHighlightLayouts((current) =>
      rangeHighlightLayoutsEqual(current, layouts) ? current : layouts
    );
  }, [previewRef, rangeHighlights]);

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const lines = getCommentableLines(preview);
    setCommentableLines((current) =>
      arraysEqual(current, lines, (left, right) => left === right)
        ? current
        : lines
    );
    updateRangeHighlightLayouts();
  });

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const view = preview.ownerDocument.defaultView ?? globalThis;
    const handleResize = () => updateRangeHighlightLayouts();
    view.addEventListener("resize", handleResize);
    const observer = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(handleResize);
    observer?.observe(preview);
    return () => {
      observer?.disconnect();
      view.removeEventListener("resize", handleResize);
    };
  }, [previewRef, updateRangeHighlightLayouts]);

  return { commentableLines, rangeHighlightLayouts };
};
