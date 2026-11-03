import { type RefObject, useCallback, useLayoutEffect, useState } from "react";
import type { RangeHighlight } from "./commentRanges";
import {
  measureHighlightGroups,
  useHighlightLayouts,
} from "../useHighlightLayouts";

export type RangeHighlightLayout = RangeHighlight & {
  bottom: number;
  top: number;
};

export const commentableBlockSelector = [
  ":scope > .commentable-block",
  ":scope > .comment-markdown-list .commentable-block",
  ":scope > .document-diff-addition > .commentable-block",
  ":scope > .document-diff-addition > .comment-markdown-list .commentable-block",
  ":scope > .document-diff-addition > dl .commentable-block",
  ":scope > dl .commentable-block",
].join(", ");

export const getCommentableLines = (preview: Element): number[] =>
  [...preview.querySelectorAll<HTMLElement>(commentableBlockSelector)]
    .map((block) => Number(block.dataset.sourceLine))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

export const measureRangeHighlightLayouts = (
  preview: HTMLElement,
  rangeHighlights: readonly RangeHighlight[],
): RangeHighlightLayout[] => {
  const blocks = [...preview.querySelectorAll<HTMLElement>(
    `${commentableBlockSelector}, :scope > .document-diff-deletion`,
  )];
  const isDiff = preview.hasAttribute("data-document-diff");

  return measureHighlightGroups(preview, rangeHighlights.flatMap((range) => {
    const groups: HTMLElement[][] = [];
    let contents: HTMLElement[] = [];
    for (const block of blocks) {
      const startLine = Number(block.dataset.sourceLine);
      const endLine = Number(block.dataset.sourceEndLine ?? startLine);
      const content = endLine >= range.startLine && startLine <= range.endLine
        ? block.querySelector<HTMLElement>(":scope > .commentable-content")
        : null;
      if (content) contents.push(content);
      else if (isDiff && contents.length > 0) {
        // A deletion or unselected block separates visible parts of the range.
        groups.push(contents);
        contents = [];
      }
    }
    if (contents.length > 0) groups.push(contents);
    return groups.map((elements) => ({ range, elements }));
  }));
};

const arraysEqual = <Value>(
  left: readonly Value[],
  right: readonly Value[],
  isEqual: (left: Value, right: Value) => boolean,
): boolean =>
  left.length === right.length &&
  left.every((value, index) => isEqual(value, right[index]));

export const useCommentableBlockLayout = (
  previewRef: RefObject<HTMLElement | null>,
  rangeHighlights: readonly RangeHighlight[],
) => {
  const [commentableLines, setCommentableLines] = useState<number[]>([]);
  const measure = useCallback((preview: HTMLElement) => {
    return measureRangeHighlightLayouts(preview, rangeHighlights);
  }, [rangeHighlights]);
  const rangeHighlightLayouts = useHighlightLayouts(previewRef, measure);

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const lines = getCommentableLines(preview);
    setCommentableLines((current) =>
      arraysEqual(current, lines, (left, right) => left === right)
        ? current
        : lines
    );
  });

  return { commentableLines, rangeHighlightLayouts };
};
