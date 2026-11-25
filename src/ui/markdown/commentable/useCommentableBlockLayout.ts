import { type RefObject, useCallback, useLayoutEffect, useState } from "react";
import type { CommentRange, RangeHighlight } from "./commentRanges";
import { getCommentAnchorLine } from "./commentRanges";
import {
  measureHighlightGroups,
  useHighlightLayouts,
  type HighlightLayout,
} from "../useHighlightLayouts";

export type RangeHighlightLayout = RangeHighlight &
  Pick<HighlightLayout, "top" | "bottom" | "outsetLeft" | "outsetRight">;

export const commentableBlockSelector = [
  ":scope > .commentable-block",
  ":scope > .comment-markdown-list .commentable-block",
  ":scope > .document-diff-addition > .commentable-block",
  ":scope > .document-diff-addition > .comment-markdown-list .commentable-block",
  ":scope > .document-diff-addition > dl .commentable-block",
  ":scope > dl .commentable-block",
  ":scope > blockquote .commentable-block",
  ":scope > .document-diff-addition > blockquote .commentable-block",
  ":scope > .commentable-table .commentable-block",
  ":scope > .document-diff-addition > .commentable-table .commentable-block",
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
        const groups: { elements: HTMLElement[]; table?: HTMLElement }[] = [];
        let contents: HTMLElement[] = [];
        let table: HTMLElement | undefined;
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
              ? block.matches(".commentable-content")
                ? block
                : block.querySelector<HTMLElement>(
                    ":scope > .commentable-content",
                  )
              : null;
          const contentTable =
            content?.closest<HTMLElement>(".commentable-table") ?? undefined;
          if (
            contents.length > 0 &&
            (content ? contentTable !== table || claimed.has(content) : isDiff)
          ) {
            // Keep wide table highlights separate from text and preserve gaps in diff mode.
            groups.push({ elements: contents, table });
            contents = [];
          }
          if (content && !claimed.has(content)) {
            contents.push(content);
            table = contentTable;
          }
        }
        if (contents.length > 0) groups.push({ elements: contents, table });
        for (const { elements } of groups) {
          for (const element of elements) claimed.add(element);
        }
        return groups.map((group) => ({ range, ...group }));
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
  const [deletedRanges, setDeletedRanges] = useState<CommentRange[]>([]);
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
  const rangeHighlightLayouts = useHighlightLayouts(
    previewRef,
    measure,
    ".commentable-table",
  );

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
