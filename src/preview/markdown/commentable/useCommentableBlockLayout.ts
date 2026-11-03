import { type RefObject, useCallback, useLayoutEffect, useState } from "react";
import type { CommentRange, RangeHighlight } from "./commentRanges";
import { getCommentAnchorLine } from "./commentRanges";
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
    ...preview.querySelectorAll<HTMLElement>(
      `${commentableBlockSelector}, :scope > .document-diff-deletion`,
    ),
  ];
  const isDiff = preview.hasAttribute("data-document-diff");
  // Claim content in priority order so a block receives exactly one highlight,
  // even when different source ranges overlap the same rendered paragraph.
  const priority = { selection: 0, comment: 1, hover: 2 };
  const claimed = new Set<HTMLElement>();

  return measureHighlightGroups(
    preview,
    [...rangeHighlights]
      .sort((a, b) => priority[a.kind] - priority[b.kind])
      .flatMap((range) => {
        const groups: HTMLElement[][] = [];
        let contents: HTMLElement[] = [];
        const overlaps = (block: HTMLElement) => {
          const startLine = Number(block.dataset.sourceLine);
          const endLine = Number(block.dataset.sourceEndLine ?? startLine);
          return endLine >= range.startLine && startLine <= range.endLine;
        };
        // Comments on blank or non-rendered source lines still highlight their anchor.
        const anchorLine =
          range.kind === "comment" && !blocks.some(overlaps)
            ? getCommentAnchorLine(range, getCommentableLines(preview))
            : undefined;
        for (const block of blocks) {
          const content =
            overlaps(block) || Number(block.dataset.sourceLine) === anchorLine
              ? block.querySelector<HTMLElement>(
                  ":scope > .commentable-content",
                )
              : null;
          if (content && !claimed.has(content)) {
            contents.push(content);
          } else if (contents.length > 0 && (isDiff || content)) {
            // A deletion or unselected block separates visible parts of the range.
            groups.push(contents);
            contents = [];
          }
        }
        if (contents.length > 0) groups.push(contents);
        for (const content of groups.flat()) claimed.add(content);
        return groups.map((elements) => ({ range, elements }));
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
  interactionRange?: CommentRange,
) => {
  const [commentableLines, setCommentableLines] = useState<number[]>([]);
  const measure = useCallback(
    (preview: HTMLElement) => {
      return measureRangeHighlightLayouts(preview, [
        ...rangeHighlights,
        ...(interactionRange
          ? [{ ...interactionRange, kind: "hover" as const }]
          : []),
      ]);
    },
    [rangeHighlights, interactionRange],
  );
  const rangeHighlightLayouts = useHighlightLayouts(previewRef, measure);

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const lines = getCommentableLines(preview);
    setCommentableLines((current) =>
      arraysEqual(current, lines, (left, right) => left === right)
        ? current
        : lines,
    );
  });

  return { commentableLines, rangeHighlightLayouts };
};
