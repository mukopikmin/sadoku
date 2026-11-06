import { type RefObject, useCallback, useLayoutEffect, useState } from "react";
import type { CommentRange, RangeHighlight } from "./commentRanges";
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
  const blocks = [
    ...preview.querySelectorAll<HTMLElement>(commentableBlockSelector),
  ];

  return measureHighlightGroups(
    preview,
    rangeHighlights.flatMap((range) => {
      const contents = blocks
        .filter((block) => {
          const startLine = Number(block.dataset.sourceLine);
          const endLine = Number(block.dataset.sourceEndLine ?? startLine);
          return endLine >= range.startLine && startLine <= range.endLine;
        })
        .map((block) =>
          block.querySelector<HTMLElement>(":scope > .commentable-content"),
        )
        .filter((content): content is HTMLElement => content !== null);
      // Keep range outlines on current content, without spanning deleted blocks.
      return preview.hasAttribute("data-document-diff")
        ? contents.map((content) => ({ range, elements: [content] }))
        : [{ range, elements: contents }];
    }),
  );
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
  const [deletedRanges, setDeletedRanges] = useState<CommentRange[]>([]);
  const measure = useCallback(
    (preview: HTMLElement) => {
      return measureRangeHighlightLayouts(preview, rangeHighlights);
    },
    [rangeHighlights],
  );
  const rangeHighlightLayouts = useHighlightLayouts(previewRef, measure);

  // Measure after every commit: Markdown DOM can change without changing the ref.
  // State updates below preserve identity when the measured values are unchanged.
  // oxlint-disable-next-line react/exhaustive-deps
  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const lines = getCommentableLines(preview);
    setCommentableLines((current) =>
      arraysEqual(current, lines, (left, right) => left === right)
        ? current
        : lines,
    );
    const ranges = [
      ...preview.querySelectorAll<HTMLElement>(
        ":scope > .document-diff-deletion[data-previous-source-line]",
      ),
    ].map((block) => ({
      startLine: Number(block.dataset.previousSourceLine),
      endLine: Number(block.dataset.previousSourceEndLine),
    }));
    setDeletedRanges((current) =>
      arraysEqual(
        current,
        ranges,
        (left, right) =>
          left.startLine === right.startLine && left.endLine === right.endLine,
      )
        ? current
        : ranges,
    );
  });

  return { commentableLines, deletedRanges, rangeHighlightLayouts };
};
